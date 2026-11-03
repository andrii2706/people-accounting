import type { SignatureVerification } from '../shared/interfaces/signature.interface.js';

/** Strength of a signature check — the best one is kept. */
export const VERIFICATION_RANK: Record<SignatureVerification, number> = { UNVERIFIED: 0, DIGEST_MATCH: 1, VALID: 2 };
