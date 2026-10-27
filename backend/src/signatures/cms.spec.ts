import * as asn1js from 'asn1js';
import gost89 from 'gost89';
import * as pkijs from 'pkijs';
import { describe, expect, it } from 'vitest';
import { normalizeSignatureFile, parseAndVerifySignature, SignatureFileError } from './cms.js';

const DOC = Buffer.from('PK\u0003\u0004 тестовий документ для підпису');

const utf8 = (value: string) => new asn1js.Utf8String({ value });
const attr = (type: string, value: asn1js.Utf8String | asn1js.PrintableString) =>
  new pkijs.AttributeTypeAndValue({ type, value });

/** Test "e-signature": self-signed ECDSA certificate with Ukrainian attributes (fictitious person). */
async function makeSigner() {
  const crypto = pkijs.getCrypto(true);
  const keys = (await crypto.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: 4242 });
  cert.issuer.typesAndValues.push(attr('2.5.4.3', utf8('Тестовий надавач')));
  cert.subject.typesAndValues.push(
    attr('2.5.4.3', utf8('Тестенко Тест Тестович')),
    attr('2.5.4.4', utf8('Тестенко')),
    attr('2.5.4.42', utf8('Тест Тестович')),
    attr('2.5.4.12', utf8('Директор')),
    attr('2.5.4.10', utf8('ТОВ "ВИГАДАНА КОМПАНІЯ"')),
    attr('2.5.4.97', new asn1js.PrintableString({ value: 'NTRUA-12345678' })),
    attr('2.5.4.5', new asn1js.PrintableString({ value: 'TINUA-1111111111' })),
  );
  cert.notBefore.value = new Date(Date.now() - 86_400_000);
  cert.notAfter.value = new Date(Date.now() + 365 * 86_400_000);
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(keys.privateKey, 'SHA-256');
  return { keys, cert };
}

function signedAttributes(digest: ArrayBuffer | Uint8Array) {
  return new pkijs.SignedAndUnsignedAttributes({
    type: 0,
    attributes: [
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.3', values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })] }),
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.5', values: [new asn1js.UTCTime({ valueDate: new Date() })] }),
      new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: digest })] }),
    ],
  });
}

function toDer(sd: pkijs.SignedData) {
  const ci = new pkijs.ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: sd.toSchema(true) });
  return Buffer.from(ci.toSchema().toBER(false));
}

async function ecdsaAttached(doc: Buffer) {
  const { keys, cert } = await makeSigner();
  const sd = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: '1.2.840.113549.1.7.1',
      eContent: new asn1js.OctetString({ valueHex: new Uint8Array(doc) }),
    }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
      }),
    ],
    certificates: [cert],
  });
  await sd.sign(keys.privateKey, 0, 'SHA-256');
  return toDer(sd);
}

async function ecdsaDetached(doc: Buffer, forge = false) {
  const { keys, cert } = await makeSigner();
  const digest = await pkijs.getCrypto(true).digest({ name: 'SHA-256' }, new Uint8Array(doc));
  const sd = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
        signedAttrs: signedAttributes(digest),
      }),
    ],
    certificates: [cert],
  });
  await sd.sign(keys.privateKey, 0, 'SHA-256', new Uint8Array(doc));
  if (forge) {
    // sign with another key under the same certificate
    const other = (await pkijs.getCrypto(true).generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    await sd.sign(other.privateKey, 0, 'SHA-256', new Uint8Array(doc));
  }
  return toDer(sd);
}

/** CMS with DSTU 4145 + GOST 34.311 algorithms (the signature itself is fake — the server does not verify it). */
async function dstuDetached(doc: Buffer) {
  const { cert } = await makeSigner();
  const si = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
    digestAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: '1.2.804.2.1.1.1.1.2.1' }),
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: '1.2.804.2.1.1.1.1.3.1.1' }),
    signedAttrs: signedAttributes(gost89.gosthash(doc)),
    signature: new asn1js.OctetString({ valueHex: new Uint8Array(64).fill(7) }),
  });
  const sd = new pkijs.SignedData({
    version: 1,
    digestAlgorithms: [new pkijs.AlgorithmIdentifier({ algorithmId: '1.2.804.2.1.1.1.1.2.1' })],
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    signerInfos: [si],
    certificates: [cert],
  });
  return toDer(sd);
}

describe('КЕП: розбір і перевірка CMS', () => {
  it('ECDSA: підпис під документ — VALID, дані сертифіката розібрано, РНОКПП замасковано', async () => {
    const p7s = await ecdsaDetached(DOC);
    const parsed = await parseAndVerifySignature(p7s, DOC);
    expect(parsed.detached).toBe(true);
    expect(parsed.signers).toHaveLength(1);
    const [s] = parsed.signers;
    expect(s.verification).toBe('VALID');
    expect(s.signatureAlgorithm).toBe('ECDSA');
    expect(s.certificate?.commonName).toBe('Тестенко Тест Тестович');
    expect(s.certificate?.title).toBe('Директор');
    expect(s.certificate?.edrpou).toBe('12345678');
    expect(s.certificate?.drfoMasked).toBe('••••••1111');
    expect(JSON.stringify(parsed.signers)).not.toContain('1111111111');
    expect(s.signingTime).toBeInstanceOf(Date);
  });

  it('приймає підпис із вкладеним документом (.p7m), лише якщо всередині саме наш документ', async () => {
    const parsed = await parseAndVerifySignature(await ecdsaAttached(DOC), DOC);
    expect(parsed.detached).toBe(false);
    expect(parsed.signers[0].verification).toBe('VALID');
    await expect(parseAndVerifySignature(await ecdsaAttached(Buffer.from('інший')), DOC)).rejects.toThrow(
      /інший документ/,
    );
  });

  it('приймає base64 і PEM так само, як DER', async () => {
    const p7s = await ecdsaDetached(DOC);
    const pem = `-----BEGIN PKCS7-----\n${p7s.toString('base64').replace(/(.{64})/g, '$1\n')}\n-----END PKCS7-----\n`;
    expect(normalizeSignatureFile(Buffer.from(pem))).toEqual(p7s);
    expect(normalizeSignatureFile(Buffer.from(p7s.toString('base64')))).toEqual(p7s);
  });

  it('відхиляє підпис під інший документ', async () => {
    const p7s = await ecdsaDetached(Buffer.from('інший документ'));
    await expect(parseAndVerifySignature(p7s, DOC)).rejects.toThrow(SignatureFileError);
  });

  it('ДСТУ 4145: перевіряє хеш ГОСТ 34.311 — DIGEST_MATCH із підказкою про czo.gov.ua', async () => {
    const p7s = await dstuDetached(DOC);
    const [s] = (await parseAndVerifySignature(p7s, DOC)).signers;
    expect(s.verification).toBe('DIGEST_MATCH');
    expect(s.digestAlgorithm).toBe('ГОСТ 34.311-95');
    expect(s.signatureAlgorithm).toBe('ДСТУ 4145');
    expect(s.notes.join(' ')).toContain('czo.gov.ua');
    await expect(parseAndVerifySignature(p7s, Buffer.from('підмінений'))).rejects.toThrow(/інший документ/);
  });

  it('відхиляє підроблений підпис (чужий ключ під сертифікатом)', async () => {
    const p7s = await ecdsaDetached(DOC, true);
    await expect(parseAndVerifySignature(p7s, DOC)).rejects.toThrow(/криптографічну перевірку/);
  });

  it('відхиляє сміття замість підпису', async () => {
    await expect(parseAndVerifySignature(Buffer.from('hello'), DOC)).rejects.toThrow(SignatureFileError);
    await expect(parseAndVerifySignature(Buffer.from([0x30, 0x03, 0x02, 0x01, 0x01]), DOC)).rejects.toThrow(SignatureFileError);
  });
});
