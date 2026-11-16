/** The part of jkurwa (DSTU 4145 / CAdES, github.com/dstucrypt/jkurwa) the KEP check uses. */
declare module 'jkurwa' {
  type Hash = (data: Uint8Array) => Uint8Array;

  export interface JkCertificateDict {
    subject: Record<string, string | undefined>;
    issuer: Record<string, string | undefined>;
    extension: { ipn?: { EDRPOU?: string; DRFO?: string } | null };
    usage: { sign: boolean; encrypt: boolean };
    verified?: boolean;
  }

  export interface JkOcspResult {
    /** The provider answered and its answer is signed properly. */
    requestOk?: boolean;
    /** The certificate is «good». */
    statusOk: boolean;
    unknown?: boolean;
  }

  export interface JkPipeEntry {
    signed?: boolean;
    error?: string;
    broken_sign?: boolean;
    broken_cert?: boolean;
    cert?: JkCertificateDict;
    ocsp?: JkOcspResult[];
    signingTime?: number | Date | null;
    tokenTime?: number | Date | null;
    contentTime?: number | Date | null;
  }

  export interface JkUnwrapResult {
    content: Buffer;
    pipe: JkPipeEntry[];
    error?: string;
  }

  export type JkQuery = (
    method: string,
    url: string,
    headers: Record<string, string | number>,
    body: Buffer,
    done: (body: Buffer | null, status: number) => void,
  ) => void;

  export class Box {
    constructor(opts: { algo: { hash?: Hash; hashes: Record<string, Hash> }; query?: JkQuery });
    loadCAs(buffer: Buffer): void;
    unwrap(data: Buffer, content?: Buffer, opts?: { ocsp?: boolean | 'lax' }): Promise<JkUnwrapResult>;
  }

  export class JkCertificate {
    serial: { toString(base: number): string };
  }

  export class Message {
    constructor(data: Buffer);
    type: string;
    info: { signerInfos?: unknown[] };
    signer(lookup: (query: unknown) => JkCertificate | null): JkCertificate;
  }

  export const models: { Message: typeof Message };
}

declare module 'dstu7564' {
  /** DSTU 7564 (Kupyna) of `bytes` bytes. */
  export function computeHash(bytes: number, data: Uint8Array): Uint8Array;
  const dstu7564: { computeHash: typeof computeHash };
  export default dstu7564;
}
