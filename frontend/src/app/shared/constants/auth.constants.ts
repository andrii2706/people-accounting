import type { SsoFailure, UserRole } from '../interfaces/auth.interface';
import type { SelectOption } from '../interfaces/ui.interface';
/** Role names in the interface. */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Головний адміністратор',
  ENTITY_ADMIN: 'Адміністратор юрособи',
  DIRECTOR: 'Директор',
  HR: 'Відповідальний за облік',
  VENDOR: 'Постачальник',
};

/** Roles in «Користувачі»: all of them — for the main administrator. */
export const ROLE_OPTIONS: SelectOption<UserRole>[] = [
  {
    value: 'HR',
    label: 'Відповідальний за облік',
    hint: 'веде облік своєї юрособи: працівники, листи, звіти',
  },
  {
    value: 'DIRECTOR',
    label: 'Директор',
    hint: 'усе в обліку своєї юрособи, її реквізити й користувачі; додає свою юрособу',
  },
  {
    value: 'ENTITY_ADMIN',
    label: 'Адміністратор юрособи',
    hint: 'облік, реквізити, доступи й користувачі своєї юрособи',
  },
  {
    value: 'ADMIN',
    label: 'Головний адміністратор',
    hint: 'усі юрособи, користувачі й налаштування',
  },
];

/** Roles the administrator / director of a legal entity may give (the rest — only the main administrator). */
export const ENTITY_ISSUED_ROLES: UserRole[] = ['HR', 'DIRECTOR'];

/** Roles that run a legal entity: its card, the access of its people, its accounts. */
export const ENTITY_MANAGER_ROLES: UserRole[] = ['ADMIN', 'ENTITY_ADMIN', 'DIRECTOR'];

/**
 * A password the administrator types for someone else: printable Latin characters without spaces (the same as
 * on the backend). A Cyrillic «а/о/с/е/і/р/х» looks like the Latin one but is another character, and a space at
 * the end is invisible — the user would type a different password and never get in.
 */
export const HANDED_OVER_PASSWORD = /^[\x21-\x7E]+$/;
export const HANDED_OVER_PASSWORD_PROBLEM = 'лише латинські літери, цифри й символи, без пробілів';

/** Where an account without «Військовий облік» goes: the portal of the domain says which modules it has. */
export const MODULE_DENIED_URL = '/?denied=oblik';
/** The portal of the domain — where «Вийти» leads a person who came in from it. */
export const PORTAL_HOME = '/';

/**
 * Where a module closed for a debt sends the user behind the portal: the portal opens and says why and what to
 * do. Alone on its domain the application signs out and its login page says it (BILLING_CLOSED_TEXT).
 */
export const MODULE_BLOCKED_URL = '/?blocked=oblik';
export const BILLING_CLOSED_TEXT =
  'Модуль недоступний: є заборгованість за користування системою. Доступ відновиться після оплати.';

/** An account created in «Військовий облік» opens this module; the other modules are given in the portal. */
export const NEW_ACCOUNT_MODULES: string[] = ['oblik'];

/** The sign-in page after a refused entrance from the portal (?reason=sso&sso=…): what happened and what to do. */
export const SSO_FAILURE_TEXT: Record<SsoFailure, string> = {
  off: 'Вхід з порталу вимкнено: у налаштуваннях військового обліку не задано адресу ключів порталу (PORTAL_JWKS_URL).',
  keys: 'Військовий облік не зміг перевірити вхід: не отримав ключі порталу. Спробуйте ще раз за хвилину; якщо повториться — повідомте адміністратора.',
  expired: 'Посилання з порталу застаріло. Відкрийте «Військовий облік» з порталу ще раз.',
  used: 'Це посилання з порталу вже використано. Відкрийте «Військовий облік» з порталу ще раз.',
  invalid:
    'Вхід з порталу не підтверджено. Відкрийте «Військовий облік» з порталу ще раз або увійдіть паролем.',
  account: 'Ваш обліковий запис у військовому обліку вимкнено. Зверніться до адміністратора.',
};
