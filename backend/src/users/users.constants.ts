import bcrypt from 'bcryptjs';
import type { UserRole } from '../shared/interfaces/auth.interface.js';

/** Roles a user can have. */
export const USER_ROLES: UserRole[] = ['ADMIN', 'ENTITY_ADMIN', 'DIRECTOR', 'HR'];

/** Roles bound to one legal entity (everyone except the main administrator and the vendor). */
export const ENTITY_ROLES: UserRole[] = ['ENTITY_ADMIN', 'DIRECTOR', 'HR'];

/** Roles that run their legal entity: its card, the access of its people, its accounts. */
export const ENTITY_MANAGERS: UserRole[] = ['ADMIN', 'ENTITY_ADMIN', 'DIRECTOR'];

/** Accounts the legal entity's administrator / director may issue (the entity administrator — only the main one). */
export const ROLES_ISSUED_BY_ENTITY: UserRole[] = ['HR', 'DIRECTOR'];

export const BCRYPT_ROUNDS = 12;

/** Hash used to equalize response time when the email does not exist (protection against email enumeration). */
export const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-password', BCRYPT_ROUNDS);

/** Roles in the letters to users. */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'головний адміністратор',
  ENTITY_ADMIN: 'адміністратор юридичної особи',
  HR: 'відповідальний за військовий облік',
  DIRECTOR: 'директор',
  VENDOR: 'постачальник системи',
};

/** The role in the letter with a temporary password: name and what it can do. */
export const ROLE_ACCESS_TEXT: Record<UserRole, { label: string; hint: string }> = {
  HR: {
    label: 'Відповідальний за військовий облік',
    hint: 'облік працівників, повідомлення й листи до ТЦК, списки та звіти',
  },
  DIRECTOR: {
    label: 'Директор',
    hint: 'усе в обліку своєї юрособи, її реквізити й користувачі, підписання документів',
  },
  ENTITY_ADMIN: {
    label: 'Адміністратор юрособи',
    hint: 'облік працівників, реквізити юрособи, доступи й користувачі юрособи',
  },
  ADMIN: { label: 'Головний адміністратор', hint: 'усі юридичні особи, користувачі й налаштування системи' },
  VENDOR: { label: 'Постачальник', hint: 'сторінка оплати' },
};
