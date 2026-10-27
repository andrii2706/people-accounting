/**
 * Parsing and verification of qualified e-signature files (CMS / CAdES, .p7s).
 *
 * Ukrainian qualified signatures come in two families:
 *  • DSTU 4145 + GOST 34.311 (classic keys of qualified providers, Diia.Pidpys, «Алмаз», «Кристал» tokens);
 *  • ECDSA/RSA + SHA-2 ("international algorithms", allowed since 2022).
 *
 * What the server does:
 *  1) parses the CMS structure and the signer certificate (name, title, organization, EDRPOU, validity);
 *  2) checks that the signature was made for our document — compares messageDigest with the hash
 *     of the frozen file (SHA-2 — Node crypto, GOST 34.311 — the gost89 library);
 *  3) for ECDSA/RSA — also verifies the signature cryptographically (pkijs + WebCrypto).
 * The chain to the qualified provider (CZO) and revocation status are not checked here —
 * legally significant verification is done at czo.gov.ua/verify, and by the recipient (TCK).
 */
import * as asn1js from 'asn1js';
import gost89 from 'gost89';
import { createHash, webcrypto } from 'node:crypto';
import * as pkijs from 'pkijs';

pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }));

export type SignatureVerification =
  /** The document matches, the signature is cryptographically valid (ECDSA/RSA). */
  | 'VALID'
  /** Документ збігається з підписаним (хеш), сам підпис ДСТУ 4145 перевіряється на czo.gov.ua. */
  | 'DIGEST_MATCH'
  /** Невідомий алгоритм — сервер не може нічого підтвердити. */
  | 'UNVERIFIED';

export interface SignerCertificate {
  commonName: string;
  surname: string;
  givenName: string;
  title: string;
  organization: string;
  organizationUnit: string;
  /** EDRPOU of the organization (from organizationIdentifier or SubjectDirectoryAttributes). */
  edrpou: string;
  /** RNOKPP of the key owner — masked only, never stored in full. */
  drfoMasked: string;
  locality: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  keyAlgorithm: string;
}

export interface ParsedSigner {
  digestAlgorithm: string;
  signatureAlgorithm: string;
  signingTime: Date | null;
  hasTimestamp: boolean;
  certificate: SignerCertificate | null;
  verification: SignatureVerification;
  /** Explanations for the user when something is wrong or the check is partial. */
  notes: string[];
}

export interface ParsedSignatureFile {
  /** DER bytes of the signature (normalized even if base64/PEM was uploaded). */
  der: Buffer;
  detached: boolean;
  signers: ParsedSigner[];
}

export class SignatureFileError extends Error {}

// ---------------------------------------------------------------- OID
const OID = {
  signedData: '1.2.840.113549.1.7.2',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5',
  contentTimestamp: '1.2.840.113549.1.9.16.2.20',
  signatureTimestamp: '1.2.840.113549.1.9.16.2.14',
  subjectKeyIdentifier: '2.5.29.14',
  subjectDirectoryAttributes: '2.5.29.9',
  uaDrfo: '1.2.804.2.1.1.1.11.1.4.1.1',
  uaEdrpou: '1.2.804.2.1.1.1.11.1.4.2.1',
} as const;

const NAME_OID: Record<string, keyof SignerCertificate> = {
  '2.5.4.3': 'commonName',
  '2.5.4.4': 'surname',
  '2.5.4.42': 'givenName',
  '2.5.4.12': 'title',
  '2.5.4.10': 'organization',
  '2.5.4.11': 'organizationUnit',
  '2.5.4.7': 'locality',
};

const DIGESTS: Record<string, { name: string; hash: (d: Buffer) => Buffer }> = {
  '1.3.14.3.2.26': { name: 'SHA-1', hash: (d) => createHash('sha1').update(d).digest() },
  '2.16.840.1.101.3.4.2.1': { name: 'SHA-256', hash: (d) => createHash('sha256').update(d).digest() },
  '2.16.840.1.101.3.4.2.2': { name: 'SHA-384', hash: (d) => createHash('sha384').update(d).digest() },
  '2.16.840.1.101.3.4.2.3': { name: 'SHA-512', hash: (d) => createHash('sha512').update(d).digest() },
  '1.2.804.2.1.1.1.1.2.1': { name: 'ГОСТ 34.311-95', hash: (d) => Buffer.from(gost89.gosthash(d)) },
};

/** Known hash functions the server cannot compute (DSTU 7564 «Купина»). */
const KNOWN_UNSUPPORTED_DIGESTS: Record<string, string> = {
  '1.2.804.2.1.1.1.1.2.2.1': 'ДСТУ 7564 (256)',
  '1.2.804.2.1.1.1.1.2.2.2': 'ДСТУ 7564 (384)',
  '1.2.804.2.1.1.1.1.2.2.3': 'ДСТУ 7564 (512)',
};

function signatureAlgorithmName(oid: string) {
  if (oid.startsWith('1.2.804.2.1.1.1.1.3.1')) return 'ДСТУ 4145';
  if (oid.startsWith('1.2.804.2.1.1.1.1.3.6')) return 'ДСТУ 9041';
  if (oid.startsWith('1.2.840.10045')) return 'ECDSA';
  if (oid.startsWith('1.2.840.113549.1.1')) return 'RSA';
  return oid;
}

const isInternational = (oid: string) => oid.startsWith('1.2.840.10045') || oid.startsWith('1.2.840.113549.1.1');

// ---------------------------------------------------------------- decoding

/** Accepts DER (.p7s), base64 or PEM — different programs save it differently. */
export function normalizeSignatureFile(input: Buffer): Buffer {
  if (input.length && input[0] === 0x30) return input;
  const text = input
    .toString('latin1')
    .replace(/-----(BEGIN|END)[^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/=_-]+$/.test(text)) {
    const der = Buffer.from(text, text.includes('-') || text.includes('_') ? 'base64url' : 'base64');
    if (der.length && der[0] === 0x30) return der;
  }
  throw new SignatureFileError('Файл не схожий на підпис CMS (.p7s). Збережіть підпис у форматі CAdES / .p7s.');
}

function text(value: unknown): string {
  const v = value as { valueBlock?: { value?: unknown } };
  return typeof v?.valueBlock?.value === 'string' ? v.valueBlock.value.trim() : '';
}

function maskDrfo(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `••••••${digits.slice(-4)}` : '';
}

function bytes(view: ArrayBuffer | ArrayBufferView) {
  return ArrayBuffer.isView(view) ? Buffer.from(view.buffer, view.byteOffset, view.byteLength) : Buffer.from(view);
}

function describeName(name: pkijs.RelativeDistinguishedNames) {
  const get = (oid: string) => text(name.typesAndValues.find((t) => t.type === oid)?.value);
  return get('2.5.4.3') || get('2.5.4.10') || '';
}

function certificateInfo(cert: pkijs.Certificate): SignerCertificate {
  const info: SignerCertificate = {
    commonName: '',
    surname: '',
    givenName: '',
    title: '',
    organization: '',
    organizationUnit: '',
    edrpou: '',
    drfoMasked: '',
    locality: '',
    issuer: describeName(cert.issuer),
    serialNumber: bytes(cert.serialNumber.valueBlock.valueHexView).toString('hex').toUpperCase(),
    validFrom: cert.notBefore.value,
    validTo: cert.notAfter.value,
    keyAlgorithm: signatureAlgorithmName(cert.subjectPublicKeyInfo.algorithm.algorithmId),
  };
  const subjectKeyOid = cert.subjectPublicKeyInfo.algorithm.algorithmId;
  if (subjectKeyOid.startsWith('1.2.804.2.1.1.1.1.3.1')) info.keyAlgorithm = 'ДСТУ 4145';
  else if (subjectKeyOid === '1.2.840.10045.2.1') info.keyAlgorithm = 'ECDSA';
  else if (subjectKeyOid === '1.2.840.113549.1.1.1') info.keyAlgorithm = 'RSA';

  for (const tv of cert.subject.typesAndValues) {
    const key = NAME_OID[tv.type];
    if (key) (info as unknown as Record<string, string>)[key] = text(tv.value);
    // 2.5.4.97 organizationIdentifier: «NTRUA-12345678»
    if (tv.type === '2.5.4.97') {
      const m = /(\d{8,10})/.exec(text(tv.value));
      if (m) info.edrpou = m[1];
    }
    // 2.5.4.5 serialNumber: «TINUA-1234567890» — RNOKPP of the owner
    if (tv.type === '2.5.4.5') {
      const v = text(tv.value);
      if (/^TINUA-/i.test(v)) info.drfoMasked = maskDrfo(v);
    }
  }

  // Old provider certificates: EDRPOU/DRFO live in SubjectDirectoryAttributes
  const sda = cert.extensions?.find((e) => e.extnID === OID.subjectDirectoryAttributes);
  if (sda) {
    try {
      const parsed = asn1js.fromBER(bytes(sda.extnValue.valueBlock.valueHexView));
      const seq = parsed.result as asn1js.Sequence;
      for (const attr of seq.valueBlock.value as asn1js.Sequence[]) {
        const [type, values] = attr.valueBlock.value as [asn1js.ObjectIdentifier, asn1js.Set];
        const value = text(values.valueBlock.value[0]);
        if (type.valueBlock.toString() === OID.uaEdrpou && !info.edrpou) info.edrpou = value;
        if (type.valueBlock.toString() === OID.uaDrfo && !info.drfoMasked) info.drfoMasked = maskDrfo(value);
      }
    } catch {
      /* нестандартне розширення — не критично */
    }
  }
  return info;
}

function findSignerCertificate(sd: pkijs.SignedData, si: pkijs.SignerInfo): pkijs.Certificate | null {
  const certs = (sd.certificates ?? []).filter((c): c is pkijs.Certificate => c instanceof pkijs.Certificate);
  if (si.sid instanceof pkijs.IssuerAndSerialNumber) {
    const sid = si.sid;
    const match = certs.find((c) => c.serialNumber.isEqual(sid.serialNumber) && c.issuer.isEqual(sid.issuer));
    if (match) return match;
  } else if (si.sid) {
    const ski = bytes((si.sid as asn1js.OctetString).valueBlock.valueHexView);
    const match = certs.find((c) => {
      const ext = c.extensions?.find((e) => e.extnID === OID.subjectKeyIdentifier);
      const parsed = ext?.parsedValue as asn1js.OctetString | undefined;
      return parsed && bytes(parsed.valueBlock.valueHexView).equals(ski);
    });
    if (match) return match;
  }
  return certs.length === 1 ? certs[0] : null;
}

function attributeTime(value: unknown): Date | null {
  if (value instanceof asn1js.UTCTime || value instanceof asn1js.GeneralizedTime) return value.toDate();
  return null;
}

// ---------------------------------------------------------------- public API

/**
 * Parses a signature file and checks that it belongs to exactly `document`.
 * Throws SignatureFileError when the signature is for another document or is corrupted.
 */
export async function parseAndVerifySignature(file: Buffer, document: Buffer): Promise<ParsedSignatureFile> {
  const der = normalizeSignatureFile(file);

  let sd: pkijs.SignedData;
  try {
    const ci = pkijs.ContentInfo.fromBER(new Uint8Array(der));
    if (ci.contentType !== OID.signedData) throw new SignatureFileError('Файл не містить підписаних даних (SignedData)');
    sd = new pkijs.SignedData({ schema: ci.content });
  } catch (err) {
    if (err instanceof SignatureFileError) throw err;
    throw new SignatureFileError('Не вдалося прочитати файл підпису — можливо, він пошкоджений або це не CMS/CAdES');
  }

  const eContent = sd.encapContentInfo.eContent;
  const attached = eContent ? bytes(eContent.getValue()) : null;
  if (attached && attached.length && !attached.equals(document)) {
    throw new SignatureFileError(
      'Підпис містить інший документ. Підписуйте саме файл, завантажений зі сторінки підписання цього листа.',
    );
  }
  if (!sd.signerInfos.length) throw new SignatureFileError('У файлі немає жодного підпису');

  const signers: ParsedSigner[] = [];
  for (const [index, si] of sd.signerInfos.entries()) {
    const notes: string[] = [];
    const digestOid = si.digestAlgorithm.algorithmId;
    const signatureOid = si.signatureAlgorithm.algorithmId;
    const attrs = si.signedAttrs?.attributes ?? [];
    const cert = findSignerCertificate(sd, si);
    if (!cert) notes.push('Сертифікат підписувача не вкладено у файл підпису');

    const signingTime = attributeTime(attrs.find((a) => a.type === OID.signingTime)?.values[0]);
    const hasTimestamp =
      attrs.some((a) => a.type === OID.contentTimestamp) ||
      (si.unsignedAttrs?.attributes ?? []).some((a) => a.type === OID.signatureTimestamp);

    // --- 1) was the signature made for our document?
    const mdAttr = attrs.find((a) => a.type === OID.messageDigest)?.values[0] as asn1js.OctetString | undefined;
    const digest = DIGESTS[digestOid];
    let digestMatches: boolean | null = null;
    if (mdAttr && digest) {
      digestMatches = bytes(mdAttr.valueBlock.valueHexView).equals(digest.hash(document));
      if (!digestMatches) {
        throw new SignatureFileError(
          'Підпис зроблено під інший документ (хеш не збігається). Завантажте файл для підпису ще раз і підпишіть саме його.',
        );
      }
    } else if (!mdAttr) {
      // without signed attributes the content itself is signed; an attached document was already compared above
      if (attached?.length) digestMatches = true;
      else notes.push('Підпис без підписаних атрибутів — перевірка відповідності документу на сервері неможлива');
    } else {
      notes.push(`Геш-функція ${KNOWN_UNSUPPORTED_DIGESTS[digestOid] ?? digestOid} не підтримується сервером`);
    }

    // --- 2) cryptographic verification (international algorithms only)
    let cryptoValid: boolean | null = null;
    if (cert && isInternational(signatureOid) && digestMatches !== null) {
      try {
        cryptoValid = await sd.verify({
          signer: index,
          data: new Uint8Array(document).buffer,
          checkChain: false,
          extendedMode: false,
        });
      } catch {
        cryptoValid = false;
      }
      if (!cryptoValid) throw new SignatureFileError('Підпис не пройшов криптографічну перевірку');
    }

    const certificate = cert ? certificateInfo(cert) : null;
    if (certificate && signingTime && (signingTime < certificate.validFrom || signingTime > certificate.validTo)) {
      notes.push('Час підпису поза строком дії сертифіката');
    }
    if (certificate && certificate.validTo < new Date()) notes.push('Строк дії сертифіката вже минув');
    if (!hasTimestamp) notes.push('Немає позначки часу (TSP) — час підпису вказано комп’ютером підписувача');

    const verification: SignatureVerification = cryptoValid ? 'VALID' : digestMatches ? 'DIGEST_MATCH' : 'UNVERIFIED';
    if (verification === 'DIGEST_MATCH') {
      notes.push('Криптографічну перевірку ДСТУ 4145 і статус сертифіката перевіряйте на czo.gov.ua/verify');
    }

    signers.push({
      digestAlgorithm: digest?.name ?? KNOWN_UNSUPPORTED_DIGESTS[digestOid] ?? digestOid,
      signatureAlgorithm: signatureAlgorithmName(signatureOid),
      signingTime,
      hasTimestamp,
      certificate,
      verification,
      notes,
    });
  }

  return { der, detached: !attached?.length, signers };
}
