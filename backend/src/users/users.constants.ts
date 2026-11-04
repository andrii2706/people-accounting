import bcrypt from 'bcryptjs';
import type { UserRole } from '../shared/interfaces/auth.interface.js';

/** Roles a user can have. */
export const USER_ROLES: UserRole[] = ['ADMIN', 'HR', 'DIRECTOR'];

export const BCRYPT_ROUNDS = 12;

/** Hash used to equalize response time when the email does not exist (protection against email enumeration). */
export const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-password', BCRYPT_ROUNDS);

/** Roles in the letters to users. */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'адміністратор',
  HR: 'працівник з військового обліку',
  DIRECTOR: 'директор (перегляд і підписання документів)',
  VENDOR: 'постачальник системи',
};

/** The role in the letter with a temporary password: name and what it can do. */
export const ROLE_ACCESS_TEXT: Record<UserRole, { label: string; hint: string }> = {
  HR: { label: 'Кадровик', hint: 'облік працівників, повідомлення й листи до ТЦК, списки та звіти' },
  DIRECTOR: { label: 'Директор', hint: 'перегляд усіх даних і підписання документів' },
  ADMIN: { label: 'Адміністратор', hint: 'облік, налаштування, юридичні особи й користувачі' },
  VENDOR: { label: 'Постачальник', hint: 'сторінка оплати' },
};
