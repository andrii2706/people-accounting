/** The owner of a qualified e-signature as the certificate states him. */
export interface KepSigner {
  /** «ПЕТРЕНКО ІВАН ІВАНОВИЧ» / «Петренко Іван Іванович» — as in the certificate. */
  fullName: string;
  /** EDRPOU of the organization in the certificate (keys of an employee); '' — a personal key. */
  edrpou: string;
  /** RNOKPP of the owner — masked only («••••••1234»). */
  drfoMasked: string;
  /** Who issued the certificate (the qualified provider). */
  issuer: string;
  serial: string;
  /** Signing time from the timestamp / the signature; null — not stated. */
  signedAt: Date | null;
}

/**
 * QUALIFIED — checked with jkurwa: the signature, the chain to a qualified provider (ЦЗО), the status (OCSP);
 * BASIC — only the structure, the hash and ECDSA/RSA (no chain) — development only.
 */
export type KepLevel = 'QUALIFIED' | 'BASIC';

export interface KepCheck {
  signer: KepSigner;
  level: KepLevel;
  /** The signature as DER — stored unchanged as the proof. */
  der: Buffer;
}
