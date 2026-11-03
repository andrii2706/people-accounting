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

/** Minimal description of the EndUser API from eusign.js that we use. */
export interface EndUserCertificate {
  infoEx?: { publicKeyType?: number; keyUsageType?: number };
}

export interface EndUserInstance {
  ReadPrivateKey(): Promise<EndUserCertificate[]>;
  SignData(
    data: Uint8Array,
    external: boolean,
    asBase64String: boolean,
    signAlgo?: number,
    previousSign?: string | null,
    signType?: number,
  ): Promise<string>;
  ResetPrivateKey?(): Promise<void>;
  destroy?(): void;
}

export interface EndUserConstructor {
  new (
    parentId: string,
    id: string,
    src: string,
    formType: number,
    formParams?: unknown,
  ): EndUserInstance;
  FormType?: Record<string, number>;
  SignAlgo?: Record<string, number>;
  SignType?: Record<string, number>;
}

export type SigningMode = 'widget' | 'upload';

/** `window` with the IIT library loaded (eusign.js defines a global EndUser). */
export interface WindowWithEndUser {
  EndUser?: EndUserConstructor;
}
