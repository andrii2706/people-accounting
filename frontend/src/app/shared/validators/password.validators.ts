/** Password policy — the same as on the backend (backend/src/common/password-policy.ts). */
export const PASSWORD_MIN_LENGTH = 12;

export function passwordProblems(password: string, email?: string): string[] {
  if (!password) return [];
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH)
    problems.push(`щонайменше ${PASSWORD_MIN_LENGTH} символів`);
  if (!/\p{L}/u.test(password)) problems.push('хоча б одна літера');
  if (!/\d/.test(password)) problems.push('хоча б одна цифра');
  const local = email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local))
    problems.push('без частини email');
  return problems;
}
