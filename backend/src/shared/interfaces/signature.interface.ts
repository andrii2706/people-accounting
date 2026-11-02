export type SignatureVerification =
  /** The document matches, the signature is cryptographically valid (ECDSA/RSA). */
  | 'VALID'
  /** Документ збігається з підписаним (хеш), сам підпис ДСТУ 4145 перевіряється на czo.gov.ua. */
  | 'DIGEST_MATCH'
  /** Невідомий алгоритм — сервер не може нічого підтвердити. */
  | 'UNVERIFIED';

export type SignatureMethod = 'WIDGET' | 'UPLOAD';

/** Summary for one signer in a .p7s file (a file may contain several). */
export interface SignerSummary {
  name: string;
  title: string;
  organization: string;
  edrpou: string;
  /** RNOKPP of the key owner — last 4 digits only. */
  drfoMasked: string;
  issuer: string;
  certificateSerial: string;
  certificateValidFrom: string;
  certificateValidTo: string;
  signingTime: string | null;
  hasTimestamp: boolean;
  digestAlgorithm: string;
  signatureAlgorithm: string;
  verification: SignatureVerification;
  notes: string[];
}

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
