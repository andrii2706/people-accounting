import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword, passwordProblems } from '../password-policy.js';
import { blindIndex, decryptField, encryptField, isEncrypted } from './field-encryption.js';
import { randomBytes } from 'node:crypto';

process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.DATABASE_URL ??= 'postgres://test@localhost/test';

describe('шифрування полів', () => {
  it('шифрує й розшифровує, щоразу з новим IV', () => {
    const a = encryptField('3200000001')!;
    const b = encryptField('3200000001')!;
    expect(isEncrypted(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('3200000001');
  });

  it('порожні й старі незашифровані значення не ламаються', () => {
    expect(encryptField('')).toBe('');
    expect(encryptField(null)).toBeNull();
    expect(decryptField('plain-legacy')).toBe('plain-legacy');
  });

  it('виявляє підміну шифротексту', () => {
    const enc = encryptField('АА000001')!;
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A') + enc.slice(-1);
    expect(() => decryptField(tampered)).toThrow();
  });

  it('сліпий індекс детермінований і нечутливий до пробілів', () => {
    expect(blindIndex('3200000001')).toBe(blindIndex(' 3200 000001 '));
    expect(blindIndex('3200000001')).not.toBe(blindIndex('3200000002'));
    expect(blindIndex('')).toBeNull();
  });
});

describe('політика паролів', () => {
  it('вимагає довжину, літери й цифри', () => {
    expect(passwordProblems('short1')).not.toEqual([]);
    expect(passwordProblems('onlyletterslong')).toContain('хоча б одна цифра');
    expect(passwordProblems('Надійний2026пароль')).toEqual([]);
    expect(passwordProblems('ivan.petrenko2026', 'ivan.petrenko@firm.ua')).toContain('без частини email');
  });

  it('тимчасовий пароль відповідає політиці', () => {
    for (let i = 0; i < 20; i++) expect(passwordProblems(generateTemporaryPassword(randomBytes))).toEqual([]);
  });
});
