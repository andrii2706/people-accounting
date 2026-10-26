/** Політика паролів для доступу до персональних даних. */
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

export function passwordMessage(problems: string[]) {
  return `Пароль: ${problems.join(', ')}`;
}

/** Тимчасовий пароль, що задовольняє політику (видається адміністратором при скиданні). */
export function generateTemporaryPassword(randomBytes: (n: number) => Buffer): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  // гарантуємо цифру й літеру
  return `${out.slice(0, 14)}${2 + (bytes[0] % 8)}a`;
}
