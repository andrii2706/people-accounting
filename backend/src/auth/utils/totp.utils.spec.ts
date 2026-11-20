import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  hotp,
  isRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  normalizeRecoveryCode,
  otpauthUrl,
  recoveryHash,
  totpStep,
  verifyTotp,
} from './totp.utils.js';

// RFC 6238, appendix B: the SHA-1 key "12345678901234567890"
const RFC_KEY = Buffer.from('12345678901234567890');
const RFC_SECRET = base32Encode(RFC_KEY);

describe('base32', () => {
  it('round-trips and matches RFC 4648', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb-oi').toString()).toBe('foobar');
    expect(() => base32Decode('MZ1')).toThrow();
  });

  it('a new secret is 160 bits', () => {
    expect(base32Decode(newTotpSecret())).toHaveLength(20);
  });
});

describe('hotp / totp', () => {
  it('RFC 4226 test values', () => {
    expect(hotp(RFC_KEY, 0)).toBe('755224');
    expect(hotp(RFC_KEY, 9)).toBe('520489');
  });

  it('RFC 6238 test values (8 digits)', () => {
    expect(hotp(RFC_KEY, totpStep(59_000), 8)).toBe('94287082');
    expect(hotp(RFC_KEY, totpStep(1_111_111_109_000), 8)).toBe('07081804');
    expect(hotp(RFC_KEY, totpStep(20_000_000_000_000), 8)).toBe('65353130');
  });

  it('accepts the current code and ±30 s, refuses older', () => {
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    const code = hotp(RFC_KEY, step);
    expect(verifyTotp(RFC_SECRET, code, null, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_KEY, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_KEY, step + 1), null, now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_KEY, step - 3), null, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, null, now)).toBe(step);
  });

  it('a code cannot be used twice', () => {
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    const code = hotp(RFC_KEY, step);
    expect(verifyTotp(RFC_SECRET, code, step, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_KEY, step - 1), step - 1, now)).toBeNull();
  });

  it('refuses what is not 6 digits', () => {
    expect(verifyTotp(RFC_SECRET, '12345', null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef', null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '1234567', null)).toBeNull();
  });
});

describe('otpauth', () => {
  it('holds the secret, issuer and login', () => {
    const url = otpauthUrl('Військовий облік', 'hr@example.com', 'ABC');
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('secret')).toBe('ABC');
    expect(parsed.searchParams.get('issuer')).toBe('Військовий облік');
    expect(decodeURIComponent(parsed.pathname)).toContain('hr@example.com');
  });
});

describe('recovery codes', () => {
  it('ten different codes XXXX-XXXX without look-alikes', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(isRecoveryCode(c)).toBe(true);
    }
  });

  it('typed in any case and without the dash', () => {
    expect(normalizeRecoveryCode(' k7qm-9xda ')).toBe('K7QM9XDA');
    expect(isRecoveryCode('k7qm 9xda')).toBe(true);
    expect(isRecoveryCode('123456')).toBe(false);
    expect(recoveryHash('k7qm9xda', 'p')).toBe(recoveryHash('K7QM-9XDA', 'p'));
    expect(recoveryHash('K7QM-9XDA', 'p')).not.toBe(recoveryHash('K7QM-9XDA', 'q'));
  });
});
