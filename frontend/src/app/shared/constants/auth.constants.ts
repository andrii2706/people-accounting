import type { UserRole } from '../interfaces/auth.interface';
import type { SelectOption } from '../interfaces/ui.interface';
/** Sign-out after this long without mouse or keyboard activity. */
export const IDLE_TIMEOUT_MS = 10 * 60_000;

/** The warning with a countdown appears this long before the sign-out. */
export const IDLE_WARNING_MS = 60_000;

/** Events that count as user activity. */
export const IDLE_ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const;

/** Activity and sign-out are shared between tabs: working in one tab keeps the others signed in. */
export const IDLE_ACTIVITY_KEY = 'mr.lastActivity';

/** Set when one tab signs out on idle — the others follow. */
export const IDLE_SIGNED_OUT_KEY = 'mr.idleSignedOut';

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
