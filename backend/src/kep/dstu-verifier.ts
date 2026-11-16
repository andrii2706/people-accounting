import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import dstu7564 from 'dstu7564';
import gost89 from 'gost89';
import { Box, models, type JkQuery, type JkUnwrapResult } from 'jkurwa';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { KepOcspMode } from '../shared/interfaces/config.interface.js';
import type { KepSigner } from '../shared/interfaces/kep.interface.js';
import { DSTU_ERRORS, KEP_CA_REFRESH_HOURS, KEP_FETCH_TIMEOUT_MS, KEP_NOT_CONFIGURED } from './kep.constants.js';
import { dstuFailure, signerFromDstu } from './utils/dstu.utils.js';

const gostHash = (data: Uint8Array) => gost89.gosthash(data);
const kupynaHash = (data: Uint8Array) => dstu7564.computeHash(32, data);
/** DSTU 4145 with GOST 34.311 (most keys) and with DSTU 7564 «Купина» (newer keys); the CA chain is GOST. */
const HASHES = {
  Gost34311: gostHash,
  Dstu4145le: gostHash,
  Dstu4145leWithDstu7564: kupynaHash,
  Dstu7564: kupynaHash,
  'Dstu7564-256': kupynaHash,
};

export interface DstuVerifierOptions {
  caUrl: string;
  caFile: string;
  ocsp: KepOcspMode;
}

/**
 * KEP_VERIFIER=dstu — the open-source jkurwa (github.com/dstucrypt/jkurwa):
 * the CAdES signature (DSTU 4145), the chain to a qualified provider from the list of ЦЗО (czo.gov.ua),
 * the key usage «підпис», the validity on the signing date and the status of the certificate (OCSP).
 */
export class DstuVerifier {
  private readonly logger = new Logger(DstuVerifier.name);
  private box: Box | null = null;
  private loadedAt = 0;
  private loading: Promise<Box> | null = null;

  constructor(
    private readonly opts: DstuVerifierOptions,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async verify(document: Buffer, der: Buffer): Promise<KepSigner> {
    let serial: string;
    try {
      const message = new models.Message(der);
      if (message.type !== 'signedData') throw new BadRequestException(DSTU_ERRORS.notSigned);
      if ((message.info.signerInfos ?? []).length !== 1) throw new BadRequestException(DSTU_ERRORS.oneSigner);
      serial = message
        .signer(() => null)
        .serial.toString(16)
        .toUpperCase();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        (err as { constructor?: { name?: string } })?.constructor?.name === 'ENOCERT'
          ? DSTU_ERRORS.noCert
          : DSTU_ERRORS.notSigned,
      );
    }

    const box = await this.ready();
    // 1) the signature and the chain to a qualified provider — without the network
    const checked = await this.unwrap(box, der, document);
    this.assertOk(checked, document);
    // 2) only then the status: the OCSP address comes from a certificate already known to be qualified.
    // The decision is ours — jkurwa's own «lax» mode lets a revoked certificate through.
    const withStatus = await this.unwrap(box, der, document, 'lax');
    this.assertOk(withStatus, document);
    const status = withStatus.pipe.at(-1)?.ocsp ?? [];
    if (status.some((s) => s.requestOk && !s.statusOk)) throw new BadRequestException(DSTU_ERRORS.revoked);
    if (this.opts.ocsp === 'strict' && (!status.length || status.some((s) => !s.requestOk))) {
      throw new BadRequestException(DSTU_ERRORS.ocspUnavailable);
    }
    const entry = checked.pipe.at(-1)!;
    return signerFromDstu(entry, serial);
  }

  private async unwrap(box: Box, der: Buffer, document: Buffer, ocsp?: 'lax'): Promise<JkUnwrapResult> {
    try {
      return await box.unwrap(der, document, ocsp ? { ocsp } : {});
    } catch (err) {
      // an algorithm jkurwa does not know (ECDSA / RSA keys) or a damaged structure
      this.logger.warn(`Підпис не перевірено: ${String(err)}`);
      throw new BadRequestException(DSTU_ERRORS.unsupported);
    }
  }

  private assertOk(result: JkUnwrapResult, document: Buffer) {
    const failure = dstuFailure(result.error, result.pipe.at(-1));
    if (failure) throw new BadRequestException(failure);
    // a signature with the content inside: it must be exactly the statement
    if (!Buffer.from(result.content).equals(document)) throw new BadRequestException(DSTU_ERRORS.otherDocument);
  }

  /** The Box with the current list of providers; refreshed once a day, the old one serves if czo.gov.ua is down. */
  private async ready(): Promise<Box> {
    const fresh = Date.now() - this.loadedAt < KEP_CA_REFRESH_HOURS * 3_600_000;
    if (this.box && fresh) return this.box;
    this.loading ??= this.load().finally(() => (this.loading = null));
    try {
      return await this.loading;
    } catch (err) {
      if (this.box) return this.box;
      this.logger.error(`Перелік кваліфікованих надавачів недоступний: ${String(err)}`);
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: KEP_NOT_CONFIGURED,
        message: DSTU_ERRORS.noCaList,
      });
    }
  }

  private async load(): Promise<Box> {
    const box = new Box({ algo: { hash: gostHash, hashes: HASHES }, query: this.query });
    box.loadCAs(await this.caList());
    this.box = box;
    this.loadedAt = Date.now();
    return box;
  }

  private async caList(): Promise<Buffer> {
    try {
      const res = await this.fetchFn(this.opts.caUrl, { signal: AbortSignal.timeout(KEP_FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = Buffer.from(await res.arrayBuffer());
      this.logger.log(`Перелік кваліфікованих надавачів завантажено з ${this.opts.caUrl}`);
      return list;
    } catch (err) {
      const file = resolve(process.cwd(), this.opts.caFile);
      this.logger.warn(`${this.opts.caUrl} не відповідає (${String(err)}) — беру копію ${file}`);
      return readFile(file);
    }
  }

  /** HTTP for the OCSP of the providers (jkurwa calls it with the address from the certificate). */
  private readonly query: JkQuery = (method, url, headers, body, done) => {
    const plainHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)]));
    this.fetchFn(url, {
      method,
      headers: plainHeaders,
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(KEP_FETCH_TIMEOUT_MS),
    })
      .then(async (res) => done(Buffer.from(await res.arrayBuffer()), res.status))
      .catch(() => done(null, 0));
  };
}
