/**
 * One-time codes of the authenticator apps (Google Authenticator, Microsoft Authenticator, 1Password…):
 * TOTP by RFC 6238 — HMAC-SHA1, 6 digits, a new code every 30 seconds.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  MFA_DIGITS,
  MFA_PERIOD_SECONDS,
  MFA_RECOVERY_ALPHABET,
  MFA_RECOVERY_CODES,
  MFA_SECRET_BYTES,
  MFA_WINDOW_STEPS,
} from '../../common/constants/auth.constants.js';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = BASE32.indexOf(ch);
    if (i < 0) throw new Error('Невірний символ у ключі');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret for the app (shown once as a QR code and as text). */
export const newTotpSecret = () => base32Encode(randomBytes(MFA_SECRET_BYTES));

/** The code for the counter (RFC 4226). */
export function hotp(secret: Buffer, counter: number, digits = MFA_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(bin).padStart(digits, '0');
}

export const totpStep = (now = Date.now()) => Math.floor(now / 1000 / MFA_PERIOD_SECONDS);

/**
 * The step the code belongs to (the current one ± MFA_WINDOW_STEPS — the phone clock may be a little off),
 * null — wrong. A step not newer than `lastStep` is refused: a code seen over the shoulder or caught on the way
 * cannot be used a second time.
 */
export function verifyTotp(secretBase32: string, code: string, lastStep: number | null, now = Date.now()) {
  const digits = code.replace(/\s/g, '');
  if (!new RegExp(`^\\d{${MFA_DIGITS}}$`).test(digits)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpStep(now);
  for (let delta = -MFA_WINDOW_STEPS; delta <= MFA_WINDOW_STEPS; delta++) {
    const step = current + delta;
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(digits))) return step;
  }
  return null;
}

/**
 * otpauth:// — what the QR code holds; the app shows «issuer (login)». The defaults (SHA-1, 6 digits, 30 s)
 * are not written out and the issuer is not repeated in the label: a shorter text — a sparser QR code that
 * a phone camera reads at once.
 */
export function otpauthUrl(issuer: string, account: string, secret: string) {
  const params = new URLSearchParams({ secret, issuer });
  return `otpauth://totp/${encodeURIComponent(account)}?${params.toString()}`;
}

/** Recovery codes «K7QM-9XDA»: for a lost phone, each works once. */
export function newRecoveryCodes(count = MFA_RECOVERY_CODES): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const chars = [...bytes].map((b) => MFA_RECOVERY_ALPHABET[b % MFA_RECOVERY_ALPHABET.length]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  });
}

/** A recovery code as it may be typed: lower case, without the dash, with spaces. */
export const normalizeRecoveryCode = (code: string) => code.replace(/[\s-]/g, '').toUpperCase();

/** Looks like a recovery code (8 characters of the alphabet), not like 6 digits from the app. */
export const isRecoveryCode = (code: string) =>
  new RegExp(`^[${MFA_RECOVERY_ALPHABET}]{8}$`).test(normalizeRecoveryCode(code));

/** Only hashes are stored; the key keeps a leaked table from being checked offline. */
export const recoveryHash = (code: string, pepper: string) =>
  createHash('sha256')
    .update(`${pepper}:${normalizeRecoveryCode(code)}`)
    .digest('hex');
