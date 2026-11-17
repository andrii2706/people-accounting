import { readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DstuVerifier } from './dstu-verifier.js';
import { DSTU_ERRORS } from './kep.constants.js';

// Test signatures and the test CA list published by ЦЗО (the person «ТЕСТ Тестовий Тест Тестович» is fictional);
// both signatures carry the signed text inside: «Test\r\n».
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const SIGNED_TEXT = Buffer.from('Test\r\n');
const CA_URL = 'https://czo.test/CACertificates.p7b';

/** czo.gov.ua answers with `caList`; every OCSP request fails (no network in tests). */
function verifier(caList: Buffer, ocsp: 'strict' | 'lax' = 'lax') {
  const fetchFn = (async (url: string | URL | Request) => {
    if (String(url) === CA_URL) return new Response(new Uint8Array(caList));
    throw new Error('offline');
  }) as typeof fetch;
  return new DstuVerifier({ caUrl: CA_URL, caFile: 'nowhere.p7b', ocsp }, fetchFn);
}

describe('перевірка КЕП бібліотекою jkurwa (ДСТУ 4145)', () => {
  // the failures below are simulated on purpose — their log lines are not test failures
  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']));

  it('підпис ДСТУ 4145 з ГОСТ 34.311: підписувач і надавач з ланцюжка ЦЗО', async () => {
    const signer = await verifier(fixture('CZO-CA-LIST.p7s')).verify(SIGNED_TEXT, fixture('test-gost-czo.p7s'));
    expect(signer.fullName).toBe('ТЕСТ Тестовий Тест Тестович');
    expect(signer.issuer).toContain('ЦЗО');
    expect(signer.serial).not.toBe('');
    expect(signer.signedAt).toBeInstanceOf(Date);
  });

  it('підпис ДСТУ 4145 з «Купиною»: РНОКПП лише замаскований', async () => {
    const signer = await verifier(fixture('CZO-CA-LIST.p7s')).verify(SIGNED_TEXT, fixture('test-kupyna-czo.p7s'));
    expect(signer.fullName).toBe('ТЕСТ Тестовий Тест Тестович');
    expect(signer.drfoMasked).not.toContain('0000000000');
    expect(signer.drfoMasked.endsWith('0000')).toBe(true);
  });

  it('підписано інший документ — відмова', async () => {
    await expect(
      verifier(fixture('CZO-CA-LIST.p7s')).verify(Buffer.from('Інша заява'), fixture('test-gost-czo.p7s')),
    ).rejects.toThrow(DSTU_ERRORS.otherDocument);
  });

  it('надавача немає в переліку ЦЗО — відмова', async () => {
    await expect(verifier(fixture('CAList.cer')).verify(SIGNED_TEXT, fixture('test-gost-czo.p7s'))).rejects.toThrow(
      DSTU_ERRORS.notQualified,
    );
  });

  it('суворий режим OCSP: статус не підтверджено — відмова', async () => {
    await expect(
      verifier(fixture('CZO-CA-LIST.p7s'), 'strict').verify(SIGNED_TEXT, fixture('test-gost-czo.p7s')),
    ).rejects.toThrow(DSTU_ERRORS.ocspUnavailable);
  });

  it('не файл підпису — зрозуміла помилка', async () => {
    await expect(
      verifier(fixture('CZO-CA-LIST.p7s')).verify(SIGNED_TEXT, Buffer.from('not a signature')),
    ).rejects.toThrow(DSTU_ERRORS.notSigned);
  });

  it('czo.gov.ua і копія недоступні — 503', async () => {
    const offline = new DstuVerifier({ caUrl: CA_URL, caFile: 'nowhere.p7b', ocsp: 'lax' }, (async () => {
      throw new Error('offline');
    }) as typeof fetch);
    await expect(offline.verify(SIGNED_TEXT, fixture('test-gost-czo.p7s'))).rejects.toThrow(DSTU_ERRORS.noCaList);
  });
});
