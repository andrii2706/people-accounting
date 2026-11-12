import type { KepLevel } from './kep.interface.js';

export type SignupStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/** Why a sign-up was refused — shown to the administrator. */
export type SignupRejectReason =
  'SIGNATURE_INVALID' | 'CERT_EDRPOU_MISMATCH' | 'NOT_IN_REGISTRY' | 'TERMINATED' | 'NOT_HEAD' | 'ENTITY_EXISTS';

/** The statement the director signs with his KEP. */
export interface SignupStatement {
  id: string;
  fileName: string;
  /** The exact bytes to sign, base64 (UTF-8 text). */
  content: string;
  expiresAt: Date;
}

export interface SignupStatementInput {
  id: string;
  edrpou: string;
  email: string;
  createdAt: Date;
}

/** GET /auth/register — whether the sign-up is open and how to sign. */
export interface SignupInfo {
  enabled: boolean;
  widget: { enabled: boolean; scriptUrl: string; frameUrl: string };
}

/** A row of the administrator's list «Реєстрації компаній». */
export interface SignupRequestView {
  id: string;
  edrpou: string;
  email: string;
  status: SignupStatus;
  reason: SignupRejectReason | null;
  reasonText: string;
  signerName: string;
  signerDrfoMasked: string;
  signerEdrpou: string;
  signerIssuer: string;
  registryHeadName: string;
  kepLevel: KepLevel | null;
  ip: string;
  createdAt: Date;
  completedAt: Date | null;
  legalEntityId: string | null;
}
