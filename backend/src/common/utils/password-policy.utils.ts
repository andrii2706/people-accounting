import type { PasswordAgeFields, UserRole } from '../../shared/interfaces/auth.interface.js';
/** Password policy for access to personal data. */
export const PASSWORD_MIN_LENGTH = 12;

export function passwordProblems(password: string, email?: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`щонайменше ${PASSWORD_MIN_LENGTH} символів`);
  if (!/\p{L}/u.test(password)) problems.push('хоча б одна літера');
  if (!/\d/.test(password)) problems.push('хоча б одна цифра');
  if (/^(.)\1+$/.test(password)) problems.push('не однакові символи');
  const local = email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) problems.push('без частини email');
  return problems;
}

/** Temporary password that satisfies the policy (issued by an administrator on reset). */
export function generateTemporaryPassword(randomBytes: (n: number) => Buffer): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  // guarantee a digit and a letter
  return `${out.slice(0, 14)}${2 + (bytes[0] % 8)}a`;
}

/**
 * When the password stops working: `maxAgeDays` after the last change for the listed roles
 * (those who keep the registration and the directors); null — the role has no limit.
 */
export function passwordExpiresAt(
  user: PasswordAgeFields,
  maxAgeDays: number,
  roles: readonly UserRole[],
): Date | null {
  if (!maxAgeDays || !roles.includes(user.role) || !user.passwordChangedAt) return null;
  return new Date(user.passwordChangedAt.getTime() + maxAgeDays * 86_400_000);
}
