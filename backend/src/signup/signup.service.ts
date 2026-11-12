import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { P7S_MIME, TEXT_MIME } from '../common/constants/mime.constants.js';
import { sha256 } from '../common/utils/hash.utils.js';
import { loadEnv } from '../config/env.js';
import { KepVerifierService } from '../kep/kep-verifier.service.js';
import { samePerson } from '../kep/utils/person-name.utils.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { KepCheck } from '../shared/interfaces/kep.interface.js';
import type { RegistryCompany } from '../shared/interfaces/legal-entity.interface.js';
import type {
  SignupInfo,
  SignupRejectReason,
  SignupRequestView,
  SignupStatement,
} from '../shared/interfaces/signup.interface.js';
import { StorageService } from '../storage/storage.service.js';
import { UsersService } from '../users/users.service.js';
import { SignupRequest } from './signup-request.entity.js';
import {
  DEFAULT_HEAD_POSITION,
  SIGNUP_ALERT_SUBJECT,
  SIGNUP_REASON_LABELS,
  SIGNUP_REJECTED,
  SIGNUP_REJECTED_MESSAGE,
  SIGNUP_STATEMENT_MINUTES,
  statementFileName,
} from './signup.constants.js';
import type { SignupStatementDto } from './signup.dto.js';
import { buildStatement } from './utils/statement.utils.js';

/** A refusal that the administrator must hear about. */
class SignupRefused extends Error {
  constructor(
    readonly reason: SignupRejectReason,
    readonly detail: string,
  ) {
    super(detail);
  }
}

/**
 * Sign-up of a company by its head:
 *  1) the code of the legal entity + the work e-mail → a statement with a unique number;
 *  2) the statement signed with the head's qualified e-signature (the IIT widget or any KEP program);
 *  3) the server checks the signature (KepVerifierService), asks the ЄДР who heads the company and compares;
 *  4) match → the legal entity (from the ЄДР) and its director are created, the temporary password goes to the
 *     e-mail; otherwise the attempt is refused, kept and the main administrators get a letter.
 */
@Injectable()
export class SignupService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @InjectRepository(SignupRequest) private readonly requests: Repository<SignupRequest>,
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly kep: KepVerifierService,
    private readonly legalEntities: LegalEntitiesService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  get enabled() {
    return this.env.selfSignupEnabled && this.kep.available && !!this.env.companyRegistryUrl;
  }

  info(): SignupInfo {
    return {
      enabled: this.enabled,
      widget: {
        enabled: !!(this.env.signWidgetScriptUrl && this.env.signWidgetFrameUrl),
        scriptUrl: this.env.signWidgetScriptUrl,
        frameUrl: this.env.signWidgetFrameUrl,
      },
    };
  }

  private assertEnabled() {
    if (!this.enabled) throw new NotFoundException('Самостійну реєстрацію вимкнено');
  }

  /** Step 1. A bot (the hidden field filled) gets a statement too, but it is never approved. */
  async statement(dto: SignupStatementDto, ip: string): Promise<SignupStatement> {
    this.assertEnabled();
    const createdAt = new Date();
    const draft = this.requests.create({
      edrpou: dto.edrpou,
      email: dto.email.trim().toLowerCase(),
      document: '',
      documentSha256: '',
      status: dto.website ? 'EXPIRED' : 'PENDING',
      ip,
      expiresAt: new Date(createdAt.getTime() + SIGNUP_STATEMENT_MINUTES * 60_000),
    });
    const saved = await this.requests.save(draft);
    const document = buildStatement({
      id: saved.id,
      edrpou: saved.edrpou,
      email: saved.email,
      createdAt: saved.createdAt,
    });
    const bytes = Buffer.from(document, 'utf8');
    await this.requests.update(saved.id, { document, documentSha256: sha256(bytes) });
    return {
      id: saved.id,
      fileName: statementFileName(saved.edrpou),
      content: bytes.toString('base64'),
      expiresAt: saved.expiresAt,
    };
  }

  /** Step 2. Returns the message for the user; a refusal is a 403 with SIGNUP_REJECTED. */
  async sign(id: string, signatureBase64: string): Promise<{ message: string }> {
    this.assertEnabled();
    const request = await this.requests.findOneBy({ id });
    if (!request || request.status !== 'PENDING') {
      throw new GoneException('Заява недійсна або вже розглянута — почніть реєстрацію знову');
    }
    if (request.expiresAt < new Date()) {
      await this.requests.update(id, { status: 'EXPIRED', completedAt: new Date() });
      throw new GoneException(`Заяву можна підписати протягом ${SIGNUP_STATEMENT_MINUTES} хв — сформуйте нову`);
    }
    const document = Buffer.from(request.document, 'utf8');

    let check: KepCheck;
    try {
      check = await this.kep.verify(document, Buffer.from(signatureBase64, 'base64'));
    } catch (err) {
      // not configured / the library is unavailable — not the user's fault, the statement stays valid
      if (err instanceof ServiceUnavailableException) throw err;
      const message = err instanceof HttpException ? err.message : String(err);
      return this.refuse(request, new SignupRefused('SIGNATURE_INVALID', message), null, null);
    }

    let company: RegistryCompany | null = null;
    try {
      company = await this.registryCompany(request.edrpou);
      await this.match(request, check, company);
      return await this.approve(request, check, company);
    } catch (err) {
      if (err instanceof SignupRefused) return this.refuse(request, err, check, company);
      throw err;
    }
  }

  private async registryCompany(edrpou: string): Promise<RegistryCompany> {
    try {
      return await this.legalEntities.lookup(edrpou);
    } catch (err) {
      if (err instanceof NotFoundException)
        throw new SignupRefused('NOT_IN_REGISTRY', `Код ${edrpou} не знайдено в ЄДР`);
      if (err instanceof BadGatewayException || err instanceof ServiceUnavailableException) {
        // the register is down — the statement stays valid, the user may try again
        throw new ServiceUnavailableException('ЄДР зараз не відповідає — спробуйте ще раз за кілька хвилин');
      }
      throw err;
    }
  }

  private async match(request: SignupRequest, check: KepCheck, company: RegistryCompany) {
    const { signer } = check;
    // a key of an employee states the organization: it must be this one
    if (signer.edrpou && signer.edrpou !== request.edrpou) {
      throw new SignupRefused(
        'CERT_EDRPOU_MISMATCH',
        `У сертифікаті код ${signer.edrpou}, у заяві — ${request.edrpou}`,
      );
    }
    if (company.terminated) throw new SignupRefused('TERMINATED', 'За ЄДР юрособа припинена або в стані припинення');
    if (!company.headFullName || !samePerson(signer.fullName, company.headFullName)) {
      throw new SignupRefused(
        'NOT_HEAD',
        `Підписав «${signer.fullName}», керівник за ЄДР — «${company.headFullName || 'не вказано'}»`,
      );
    }
    if (await this.entities.existsBy({ edrpou: request.edrpou })) {
      throw new SignupRefused('ENTITY_EXISTS', 'Юрособа з цим кодом уже працює в застосунку');
    }
  }

  private async approve(request: SignupRequest, check: KepCheck, company: RegistryCompany) {
    if (await this.users.emailTaken(request.email)) {
      throw new BadRequestException(
        'Цей email уже використовується — увійдіть або попросіть адміністратора скинути пароль',
      );
    }
    const signatureKey = await this.keepProof(request, check);
    const entity = await this.entities.save(
      this.entities.create({
        edrpou: request.edrpou,
        fullName: company.fullName,
        shortName: company.shortName,
        address: company.address,
        postalCode: company.postalCode,
        email: request.email,
        headPosition: DEFAULT_HEAD_POSITION,
        headName: company.headName,
        billingRequired: true,
      }),
    );
    let userId: string;
    try {
      const user = await this.users.registerHead(titleCase(company.headFullName), request.email, entity.id);
      userId = user.id;
    } catch (err) {
      await this.entities.delete(entity.id);
      throw err;
    }
    await this.entities.update(entity.id, { headUserId: userId });
    await this.requests.update(request.id, {
      status: 'APPROVED',
      ...this.signerFields(check, company),
      signatureKey,
      legalEntityId: entity.id,
      userId,
      completedAt: new Date(),
    });
    await this.audit.log('legal_entity', entity.id, 'REGISTER', {
      edrpou: [null, request.edrpou],
      email: [null, request.email],
      signer: [null, check.signer.fullName],
      kep: [null, check.level],
    });
    return {
      message: 'Підпис керівника підтверджено. На робочу пошту надіслано тимчасовий пароль — увійдіть і змініть його.',
    };
  }

  /** The statement and its signature, unchanged — the proof of who created the legal entity. */
  private async keepProof(request: SignupRequest, check: KepCheck) {
    const base = `signups/${request.id}`;
    await this.storage.put(`${base}/statement.txt`, Buffer.from(request.document, 'utf8'), TEXT_MIME);
    await this.storage.put(`${base}/statement.txt.p7s`, check.der, P7S_MIME);
    return `${base}/statement.txt.p7s`;
  }

  private signerFields(check: KepCheck | null, company: RegistryCompany | null) {
    return {
      signerName: check?.signer.fullName.slice(0, 300) ?? '',
      signerDrfoMasked: check?.signer.drfoMasked ?? '',
      signerEdrpou: check?.signer.edrpou.slice(0, 10) ?? '',
      signerIssuer: check?.signer.issuer.slice(0, 500) ?? '',
      kepLevel: check?.level ?? null,
      registryHeadName: company?.headFullName.slice(0, 300) ?? '',
    };
  }

  private async refuse(
    request: SignupRequest,
    refusal: SignupRefused,
    check: KepCheck | null,
    company: RegistryCompany | null,
  ): Promise<never> {
    await this.requests.update(request.id, {
      status: 'REJECTED',
      reason: refusal.reason,
      reasonText: refusal.detail.slice(0, 500),
      ...this.signerFields(check, company),
      completedAt: new Date(),
    });
    await this.audit.log('signup', request.id, 'REGISTER_REJECTED', {
      edrpou: [null, request.edrpou],
      email: [null, request.email],
      reason: [null, refusal.reason],
      signer: [null, check?.signer.fullName ?? ''],
      ip: [null, request.ip],
    });
    await this.alertAdmins(request, refusal, check).catch((err: unknown) =>
      this.logger.error(`Лист про відхилену реєстрацію не надіслано: ${String(err)}`),
    );
    throw new ForbiddenException({ statusCode: 403, code: SIGNUP_REJECTED, message: SIGNUP_REJECTED_MESSAGE });
  }

  private async alertAdmins(request: SignupRequest, refusal: SignupRefused, check: KepCheck | null) {
    const to = [...new Set([...(await this.users.adminEmails()), this.env.adminEmail ?? ''].filter(Boolean))];
    if (!to.length) return;
    const lines = [
      'Хтось спробував зареєструвати юридичну особу в застосунку, але перевірку не пройдено.',
      '',
      `Причина: ${SIGNUP_REASON_LABELS[refusal.reason]} — ${refusal.detail}`,
      `Код ЄДРПОУ: ${request.edrpou}`,
      `Email у заяві: ${request.email}`,
      `Підписант за сертифікатом: ${check?.signer.fullName || '—'}${check?.signer.drfoMasked ? ` (РНОКПП ${check.signer.drfoMasked})` : ''}`,
      `Надавач: ${check?.signer.issuer || '—'}`,
      `IP: ${request.ip || '—'}`,
      `Час: ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}`,
      '',
      `Усі спроби: ${this.env.appUrl}/settings/signups`,
    ];
    await this.notifications.sendTo(to, SIGNUP_ALERT_SUBJECT, lines.join('\n'));
  }

  /** The administrator's list: the latest first. */
  async list(): Promise<SignupRequestView[]> {
    const rows = await this.requests.find({
      where: [{ status: 'APPROVED' }, { status: 'REJECTED' }],
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      edrpou: r.edrpou,
      email: r.email,
      status: r.status,
      reason: r.reason,
      reasonText: r.reasonText,
      signerName: r.signerName,
      signerDrfoMasked: r.signerDrfoMasked,
      signerEdrpou: r.signerEdrpou,
      signerIssuer: r.signerIssuer,
      registryHeadName: r.registryHeadName,
      kepLevel: r.kepLevel,
      ip: r.ip,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      legalEntityId: r.legalEntityId,
    }));
  }

  /** Refused attempts since `since` — for the administrator's inbox. */
  refusedSince(since: Date) {
    return this.requests
      .createQueryBuilder('r')
      .where('r.status = :s', { s: 'REJECTED' })
      .andWhere('r.completedAt >= :since', { since })
      .orderBy('r.completedAt', 'DESC')
      .getMany();
  }
}

/** «ПЕТРЕНКО ІВАН ІВАНОВИЧ» → «Петренко Іван Іванович». */
function titleCase(name: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/(^|[-'’ʼ])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase()))
    .join(' ');
}
