import type { SignatureVerification } from '../shared/interfaces/signature.interface.js';

/** Strength of a signature check — the best one is kept. */
export const VERIFICATION_RANK: Record<SignatureVerification, number> = { UNVERIFIED: 0, DIGEST_MATCH: 1, VALID: 2 };

/** A .p7s in base64 (~700 KB) — the same bound for letters, the sign-up and the offer. */
export const MAX_SIGNATURE_BASE64 = 1_000_000;
