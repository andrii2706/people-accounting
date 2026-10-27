declare module 'gost89' {
  /** GOST 34.311-95 with the S-box of DKE No. 1 (as used by Ukrainian e-signatures). */
  export function gosthash(data: Uint8Array): Uint8Array;
  const gost89: { gosthash: typeof gosthash };
  export default gost89;
}
