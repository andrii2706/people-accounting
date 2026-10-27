/** VALID — cryptographically verified; DIGEST_MATCH — the document matches (DSTU is verified at czo.gov.ua). */
export type SignatureVerification = 'VALID' | 'DIGEST_MATCH' | 'UNVERIFIED';

export type SignatureMethod = 'WIDGET' | 'UPLOAD';

export interface SignerSummary {
  name: string;
  title: string;
  organization: string;
  edrpou: string;
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

export interface LetterSignature {
  id: string;
  letterId: string;
  documentSha256: string;
  fileSha256: string;
  fileSize: number;
  method: SignatureMethod;
  verification: SignatureVerification;
  signers: SignerSummary[];
  uploadedByName: string;
  createdAt: string;
}

/** E-signing state of a letter: frozen document and collected signatures. */
export interface SigningState {
  frozen: boolean;
  documentSha256: string | null;
  documentFilename: string | null;
  documentFrozenAt: string | null;
  signatures: LetterSignature[];
}

export interface SigningConfig {
  widget: { enabled: boolean; scriptUrl: string; frameUrl: string };
  verifyUrl: string;
}
