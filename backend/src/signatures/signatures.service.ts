import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth.js';
import { loadEnv } from '../config/env.js';
import {
  LetterSignature,
  type SignatureMethod,
  type SignatureVerification,
  type SignerSummary,
} from '../letters/entities/letter-signature.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import { DOCX_MIME, LettersService, P7S_MIME } from '../letters/letters.service.js';
import { StorageService } from '../storage/storage.service.js';
import { parseAndVerifySignature, type ParsedSigner, SignatureFileError } from './cms.js';

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const RANK: Record<SignatureVerification, number> = { UNVERIFIED: 0, DIGEST_MATCH: 1, VALID: 2 };

function summary(s: ParsedSigner): SignerSummary {
  const c = s.certificate;
  const name = c ? c.commonName || [c.surname, c.givenName].filter(Boolean).join(' ') : '';
  return {
    name: name || 'Невідомий підписувач',
    title: c?.title ?? '',
    organization: c?.organization ?? '',
    edrpou: c?.edrpou ?? '',
    drfoMasked: c?.drfoMasked ?? '',
    issuer: c?.issuer ?? '',
    certificateSerial: c?.serialNumber ?? '',
    certificateValidFrom: c?.validFrom.toISOString() ?? '',
    certificateValidTo: c?.validTo.toISOString() ?? '',
    signingTime: s.signingTime?.toISOString() ?? null,
    hasTimestamp: s.hasTimestamp,
    digestAlgorithm: s.digestAlgorithm,
    signatureAlgorithm: s.signatureAlgorithm,
    verification: s.verification,
    notes: s.notes,
  };
}

/**
 * Підписання листів КЕП.
 *
 * Потік:
 *  1. «Зафіксувати документ» — .docx генерується один раз і зберігається (write-once) разом із SHA-256.
 *     Далі лист не редагується, а завантажується саме цей файл.
 *  2. Документ підписують будь-яким засобом КЕП: віджетом ІІТ прямо в застосунку або зовнішньою
 *     програмою (Дія.Підпис на id.gov.ua, czo.gov.ua/sign, «ІІТ Користувач ЦСК», Вчасно, M.E.Doc…)
 *     у форматі CAdES з окремим підписом (.p7s).
 *  3. Сервер перевіряє, що .p7s стосується саме цього документа, і зберігає його незмінним.
 *  4. До ТЦК надсилається пакет: документ + усі .p7s.
 */
@Injectable()
export class SignaturesService {
  constructor(
    @InjectRepository(OutgoingLetter) private readonly letters: Repository<OutgoingLetter>,
    @InjectRepository(LetterSignature) private readonly signatures: Repository<LetterSignature>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly lettersService: LettersService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  config() {
    const env = loadEnv();
    return {
      widget: {
        enabled: !!(env.signWidgetScriptUrl && env.signWidgetFrameUrl),
        scriptUrl: env.signWidgetScriptUrl,
        frameUrl: env.signWidgetFrameUrl,
      },
      verifyUrl: env.signVerifyUrl,
    };
  }

  private async letter(id: string) {
    const letter = await this.letters.findOneBy({ id });
    if (!letter) throw new NotFoundException('Лист не знайдено');
    return letter;
  }

  // ---------------------------------------------------------------- фіксація документа

  async freeze(id: string, user: AuthUser) {
    const letter = await this.letter(id);
    if (letter.documentKey) return this.state(id);

    const { buffer, filename } = await this.lettersService.document(id);
    const hash = sha256(buffer);
    const key = `letters/${letter.year}/${letter.id}/document-${hash.slice(0, 16)}.docx`;
    if (!(await this.storage.exists(key))) await this.storage.put(key, buffer, DOCX_MIME);

    await this.dataSource.transaction(async (m) => {
      const locked = await m
        .getRepository(OutgoingLetter)
        .createQueryBuilder('l')
        .setLock('pessimistic_write')
        .where('l.id = :id', { id })
        .getOne();
      if (!locked || locked.documentKey) return; // хтось уже зафіксував паралельно
      await m.getRepository(OutgoingLetter).update(id, {
        documentKey: key,
        documentSha256: hash,
        documentFilename: filename,
        documentFrozenAt: new Date(),
      });
      await this.audit.log('letter', id, 'UPDATE', { documentSha256: [null, hash] }, user, m);
    });
    return this.state(id);
  }

  /** Скасувати фіксацію (щоб виправити дані й перегенерувати), поки немає жодного підпису. */
  async unfreeze(id: string, user: AuthUser) {
    const letter = await this.letter(id);
    if (!letter.documentKey) return this.state(id);
    if (letter.status === 'SENT') throw new BadRequestException('Лист уже надіслано');
    if (await this.signatures.countBy({ letterId: id })) {
      throw new BadRequestException('Документ уже підписано — скасувати фіксацію не можна');
    }
    await this.letters.update(id, { documentKey: null, documentSha256: null, documentFilename: null, documentFrozenAt: null });
    await this.audit.log('letter', id, 'UPDATE', { documentSha256: [letter.documentSha256, null] }, user);
    return this.state(id);
  }

  frozenDocument(id: string) {
    return this.lettersService.frozenDocument(id);
  }

  // ---------------------------------------------------------------- підписи

  async state(id: string) {
    const letter = await this.letter(id);
    const signatures = await this.signatures.find({ where: { letterId: id }, order: { createdAt: 'ASC' } });
    return {
      frozen: !!letter.documentKey,
      documentSha256: letter.documentSha256,
      documentFilename: letter.documentFilename,
      documentFrozenAt: letter.documentFrozenAt,
      signatures: signatures.map(({ fileKey: _k, ...s }) => s),
    };
  }

  async add(id: string, base64: string, method: SignatureMethod, user: AuthUser) {
    const { letter, buffer: document } = await this.frozenDocument(id);
    const file = Buffer.from(base64, 'base64');
    if (!file.length) throw new BadRequestException('Порожній файл підпису');

    let parsed;
    try {
      parsed = await parseAndVerifySignature(file, document);
    } catch (err) {
      if (err instanceof SignatureFileError) throw new BadRequestException(err.message);
      throw err;
    }

    const fileHash = sha256(parsed.der);
    if (await this.signatures.existsBy({ letterId: id, fileSha256: fileHash })) {
      throw new ConflictException('Цей файл підпису вже додано');
    }
    const signers = parsed.signers.map(summary);
    const verification = signers.reduce<SignatureVerification>(
      (worst, s) => (RANK[s.verification] < RANK[worst] ? s.verification : worst),
      'VALID',
    );

    const key = `letters/${letter.year}/${letter.id}/signature-${fileHash.slice(0, 16)}.p7s`;
    if (!(await this.storage.exists(key))) await this.storage.put(key, parsed.der, P7S_MIME);

    const saved = await this.dataSource.transaction(async (m) => {
      const row = await m.getRepository(LetterSignature).save(
        m.getRepository(LetterSignature).create({
          letterId: id,
          documentSha256: letter.documentSha256!,
          fileKey: key,
          fileSha256: fileHash,
          fileSize: parsed.der.length,
          method,
          verification,
          signers,
          uploadedById: user.id,
          uploadedByName: user.fullName,
        }),
      );
      await this.audit.log(
        'letter',
        id,
        'SIGN',
        { signers: [null, signers.map((s) => s.name).join(', ')], verification: [null, verification], method: [null, method] },
        user,
        m,
      );
      return row;
    });
    const { fileKey: _k, ...result } = saved;
    return result;
  }

  async signatureFile(letterId: string, signatureId: string) {
    const sig = await this.signatures.findOneBy({ id: signatureId, letterId });
    if (!sig) throw new NotFoundException('Підпис не знайдено');
    const { filename } = await this.frozenDocument(letterId);
    return { buffer: await this.storage.get(sig.fileKey), filename: `${filename}.p7s` };
  }

  signedAttachments(letterId: string) {
    return this.lettersService.signedAttachments(letterId);
  }

  /** ZIP: документ + підписи + опис — для передачі в ТЦК будь-яким каналом. */
  async signedPackage(letterId: string) {
    const attachments = await this.signedAttachments(letterId);
    if (!attachments) throw new BadRequestException('Документ ще не підписано');
    const letter = await this.letter(letterId);
    const sigs = await this.signatures.find({ where: { letterId }, order: { createdAt: 'ASC' } });

    const zip = new JSZip();
    for (const a of attachments) zip.file(a.filename, a.content);
    const lines = [
      `Лист вих. № ${letter.number} від ${letter.date}`,
      `Документ: ${letter.documentFilename}`,
      `SHA-256: ${letter.documentSha256}`,
      '',
      'Підписи (CAdES, окремий файл .p7s):',
      ...sigs.flatMap((s) =>
        s.signers.map(
          (p) =>
            `  • ${p.name}${p.title ? `, ${p.title}` : ''}${p.organization ? `, ${p.organization}` : ''}` +
            `${p.signingTime ? ` — ${p.signingTime}` : ''} (${p.signatureAlgorithm})`,
        ),
      ),
      '',
      `Перевірити підпис: ${loadEnv().signVerifyUrl}`,
    ];
    zip.file('Підписи.txt', lines.join('\r\n'));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const safe = letter.number.replace(/[\\/:*?"<>|]/g, '-');
    return { buffer, filename: `Лист ${safe} (підписаний).zip` };
  }
}
