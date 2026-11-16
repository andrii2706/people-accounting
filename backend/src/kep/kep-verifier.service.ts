import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { loadEnv } from '../config/env.js';
import type { KepCheck, KepSigner } from '../shared/interfaces/kep.interface.js';
import { normalizeSignatureFile, parseAndVerifySignature, SignatureFileError } from '../signatures/utils/cms.utils.js';
import { DstuVerifier } from './dstu-verifier.js';
import { KEP_NOT_CONFIGURED, KEP_NOT_CONFIGURED_MESSAGE } from './kep.constants.js';
import { certificateFullName } from './utils/person-name.utils.js';

/**
 * Check of a qualified e-signature that identifies a person (the sign-up of a company, the offer).
 *
 * Unlike the signatures under letters (the TCK checks them itself), here the signature IS the proof
 * of who acts, so the check must cover the chain to a qualified provider and the certificate status:
 *  • KEP_VERIFIER=dstu — the open-source jkurwa (DSTU 4145): chain to the ЦЗО list, key usage, OCSP;
 *  • KEP_VERIFIER=basic — structure, hash, ECDSA/RSA without the chain — local development only
 *    (env.ts refuses it in production);
 *  • not set — `available` is false: the sign-up is off and the offer is not required.
 */
@Injectable()
export class KepVerifierService {
  private readonly env = loadEnv();
  private dstu: DstuVerifier | null = null;

  get available(): boolean {
    return this.env.kepVerifier !== '';
  }

  get level() {
    return this.env.kepVerifier === 'basic' ? 'BASIC' : 'QUALIFIED';
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
    const signer =
      this.env.kepVerifier === 'dstu' ? await this.viaDstu(document, der) : await this.basic(document, der);
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

  private viaDstu(document: Buffer, der: Buffer): Promise<KepSigner> {
    this.dstu ??= new DstuVerifier({
      caUrl: this.env.kepCaUrl,
      caFile: this.env.kepCaFile,
      ocsp: this.env.kepOcsp,
    });
    return this.dstu.verify(document, der);
  }
}
