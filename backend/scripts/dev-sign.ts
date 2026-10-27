/**
 * Test signature for development and QA — NOT a qualified e-signature and has no legal force.
 * Creates a one-off ECDSA key with a self-signed certificate of a fictitious person
 * and makes a detached CAdES signature (.p7s) next to the file:
 *
 *   npm run dev:sign -- "Повідомлення 12.docx"     →  "Повідомлення 12.docx.p7s"
 *
 * The resulting .p7s can be uploaded on the letter page ("Додати файл .p7s").
 */
import * as asn1js from 'asn1js';
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import * as pkijs from 'pkijs';

pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }));

const path = process.argv[2];
if (!path) {
  console.error('Вкажіть файл: npm run dev:sign -- <файл.docx>');
  process.exit(1);
}
const doc = new Uint8Array(readFileSync(path));
const crypto = pkijs.getCrypto(true);
const name = (type: string, value: string) => new pkijs.AttributeTypeAndValue({ type, value: new asn1js.Utf8String({ value }) });

const keys = (await crypto.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
const cert = new pkijs.Certificate();
cert.version = 2;
cert.serialNumber = new asn1js.Integer({ value: Date.now() % 1_000_000_000 });
cert.issuer.typesAndValues.push(name('2.5.4.3', 'ТЕСТОВИЙ надавач (не КЕП)'));
cert.subject.typesAndValues.push(
  name('2.5.4.3', 'Тестовий Підписувач'),
  name('2.5.4.12', 'Директор (тест)'),
  name('2.5.4.10', 'ТЕСТОВА ОРГАНІЗАЦІЯ'),
);
cert.notBefore.value = new Date(Date.now() - 60_000);
cert.notAfter.value = new Date(Date.now() + 30 * 86_400_000);
await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
await cert.sign(keys.privateKey, 'SHA-256');

const digest = await crypto.digest({ name: 'SHA-256' }, doc);
const sd = new pkijs.SignedData({
  version: 1,
  encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
  signerInfos: [
    new pkijs.SignerInfo({
      version: 1,
      sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
      signedAttrs: new pkijs.SignedAndUnsignedAttributes({
        type: 0,
        attributes: [
          new pkijs.Attribute({ type: '1.2.840.113549.1.9.3', values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })] }),
          new pkijs.Attribute({ type: '1.2.840.113549.1.9.5', values: [new asn1js.UTCTime({ valueDate: new Date() })] }),
          new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: digest })] }),
        ],
      }),
    }),
  ],
  certificates: [cert],
});
await sd.sign(keys.privateKey, 0, 'SHA-256', doc);
const ci = new pkijs.ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: sd.toSchema(true) });
writeFileSync(`${path}.p7s`, Buffer.from(ci.toSchema().toBER(false)));
console.log(`Тестовий підпис (не КЕП): ${path}.p7s`);
