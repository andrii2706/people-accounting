import { createHash } from 'node:crypto';

/** SHA-256 hex of a buffer (document digests, signature checks). */
export const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
