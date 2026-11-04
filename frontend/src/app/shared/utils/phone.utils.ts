import { DEFAULT_PHONE_CODE, PHONE_COUNTRIES } from '../constants/phone.constants';
import type { PhoneParts } from '../interfaces/phone.interface';
import { normalizePhone } from '../validators/employee-rules';

/** Codes from the longest: «+380…» must not be taken for «+38…» of another country. */
const CODES = PHONE_COUNTRIES.map((c) => c.code).sort((a, b) => b.length - a.length);

/** «+380671234567» → { code: '380', national: '671234567' }; an unknown code keeps all digits. */
export function splitPhone(value: string | null | undefined): PhoneParts {
  const normalized = normalizePhone(value ?? '');
  if (!normalized.startsWith('+'))
    return { code: DEFAULT_PHONE_CODE, national: normalized.replace(/\D/g, '') };
  const digits = normalized.slice(1);
  const code = CODES.find((c) => digits.startsWith(c));
  return code ? { code, national: digits.slice(code.length) } : { code: '', national: digits };
}

/**
 * The national digits typed by the user → the stored value «+<code><digits>».
 * A Ukrainian number typed with the leading 0 (067…) loses it; empty → ''.
 */
export function joinPhone(code: string, typed: string): string {
  let national = typed.replace(/\D/g, '');
  if (!national) return '';
  if (code === DEFAULT_PHONE_CODE && national.startsWith('0')) national = national.slice(1);
  if (code && national.startsWith(code) && national.length > 10)
    national = national.slice(code.length);
  return `+${code}${national}`;
}

/** «+380671234567» → «+380 67 123 45 67» for reading; other countries — code and digits in groups of 3. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  const { code, national } = splitPhone(value);
  if (!code) return value;
  if (code === DEFAULT_PHONE_CODE && national.length === 9) {
    return `+380 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
  }
  return `+${code} ${national.replace(/(\d{3})(?=\d)/g, '$1 ')}`;
}
