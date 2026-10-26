/** VALID — криптографічно перевірено; DIGEST_MATCH — документ збігається (ДСТУ перевіряється на czo.gov.ua). */
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

/** Стан підписання листа: зафіксований документ і зібрані підписи. */
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
