import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../config/env.js';
import type {
  IitLoaderModule,
  IitSignInfo,
  IitVerifier,
  KepCheck,
  KepSigner,
} from '../shared/interfaces/kep.interface.js';
import { normalizeSignatureFile, parseAndVerifySignature, SignatureFileError } from '../signatures/utils/cms.utils.js';
import { KEP_NOT_CONFIGURED, KEP_NOT_CONFIGURED_MESSAGE } from './kep.constants.js';
import { signerFromIit } from './utils/iit.utils.js';
import { certificateFullName } from './utils/person-name.utils.js';

/**
 * Check of a qualified e-signature that identifies a person (the sign-up of a company, the offer).
 *
 * Unlike the signatures under letters (the TCK checks them itself), here the signature IS the proof
 * of who acts, so the check must cover the chain to a qualified provider and the certificate status:
 *  • KEP_VERIFIER=iit — the IIT library (backend/iit/README.md): DSTU 4145 / ECDSA / RSA, chain, OCSP;
 *  • KEP_VERIFIER=basic — structure, hash, ECDSA/RSA without the chain — local development only
 *    (env.ts refuses it in production);
 *  • not set — `available` is false: the sign-up is off and the offer is not required.
 */
@Injectable()
export class KepVerifierService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(KepVerifierService.name);
  private iit: Promise<IitVerifier> | null = null;

  get available(): boolean {
    return this.env.kepVerifier !== '';
  }

  get level() {
    return this.env.kepVerifier === 'iit' ? 'QUALIFIED' : 'BASIC';
  }

  /** The detached signature `file` (.p7s: DER, base64 or PEM) of exactly `document`, one signer. */
  async verify(document: Buffer, file: Buffer): Promise<KepCheck> {
    if (!this.available) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: KEP_NOT_CONFIGURED,
        message: KEP_NOT_CONFIGURED_MESSAGE,
      });
    }
    let der: Buffer;
    try {
      der = normalizeSignatureFile(file);
    } catch {
      throw new BadRequestException('Не вдалося прочитати файл підпису — оберіть файл .p7s');
    }
    const signer = this.env.kepVerifier === 'iit' ? await this.viaIit(document, der) : await this.basic(document, der);
    if (!signer.fullName.trim()) throw new BadRequestException('У сертифікаті підписувача немає імені');
    return { signer, level: this.level, der };
  }

  private async basic(document: Buffer, der: Buffer): Promise<KepSigner> {
    try {
      const parsed = await parseAndVerifySignature(der, document);
      if (parsed.signers.length !== 1) throw new SignatureFileError('Потрібен рівно один підпис — керівника');
      const [s] = parsed.signers;
      if (!s.certificate) throw new SignatureFileError('У файлі підпису немає сертифіката підписувача');
      if (s.verification === 'UNVERIFIED') throw new SignatureFileError(s.notes[0] ?? 'Підпис не перевірено');
      if (s.certificate.validTo < new Date() || s.certificate.validFrom > new Date()) {
        throw new SignatureFileError('Сертифікат підписувача недійсний за строком');
      }
      return {
        fullName: certificateFullName(s.certificate),
        edrpou: s.certificate.edrpou,
        drfoMasked: s.certificate.drfoMasked,
        issuer: s.certificate.issuer,
        serial: s.certificate.serialNumber,
        signedAt: s.signingTime,
      };
    } catch (err) {
      if (err instanceof SignatureFileError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  private async viaIit(document: Buffer, der: Buffer): Promise<KepSigner> {
    const lib = await this.loadIit();
    let result: IitSignInfo | IitSignInfo[];
    try {
      result = await lib.VerifyData(new Uint8Array(document), new Uint8Array(der));
    } catch (err) {
      // the IIT errors are user-readable: «Сертифікат відкликано», «Підпис не відповідає даним» …
      const message = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err);
      throw new BadRequestException(`Підпис не пройшов перевірку: ${message}`);
    }
    const infos = Array.isArray(result) ? result : [result];
    if (infos.length !== 1) throw new BadRequestException('Потрібен рівно один підпис — керівника');
    return signerFromIit(infos[0]);
  }

  private loadIit(): Promise<IitVerifier> {
    this.iit ??= (async () => {
      const path = resolve(process.cwd(), this.env.iitLoaderPath);
      try {
        const mod = (await import(pathToFileURL(path).href)) as IitLoaderModule;
        const verifier = await mod.createVerifier();
        this.logger.log('Бібліотеку ІІТ ініціалізовано');
        return verifier;
      } catch (err) {
        this.iit = null;
        this.logger.error(`Не вдалося завантажити бібліотеку ІІТ (${path}): ${String(err)}`);
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: KEP_NOT_CONFIGURED,
          message: 'Бібліотека перевірки підпису недоступна. Спробуйте пізніше або зверніться до постачальника.',
        });
      }
    })();
    return this.iit;
  }
}
