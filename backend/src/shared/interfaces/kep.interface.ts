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
 * QUALIFIED — checked by the IIT library: the signature, the chain to a qualified provider, the status (OCSP);
 * BASIC — only the structure, the hash and ECDSA/RSA (no chain) — development only.
 */
export type KepLevel = 'QUALIFIED' | 'BASIC';

export interface KepCheck {
  signer: KepSigner;
  level: KepLevel;
  /** The signature as DER — stored unchanged as the proof. */
  der: Buffer;
}

/** EndUserOwnerInfo of the IIT library (the fields we use). */
export interface IitOwnerInfo {
  issuerCN?: string;
  serial?: string;
  subjCN?: string;
  subjFullName?: string;
  subjEDRPOUCode?: string;
  subjDRFOCode?: string;
}

/** EndUserSignInfo of the IIT library (the fields we use). */
export interface IitSignInfo {
  ownerInfo?: IitOwnerInfo;
  timeInfo?: { isTimeAvail?: boolean; time?: Date | string };
}

/** What the loader (backend/iit/iit-loader.mjs) returns: an initialized IIT EndUser object. */
export interface IitVerifier {
  VerifyData(data: Uint8Array, sign: Uint8Array, signIndex?: number): Promise<IitSignInfo | IitSignInfo[]>;
}

export interface IitLoaderModule {
  createVerifier(): Promise<IitVerifier>;
}
