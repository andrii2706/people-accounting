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
  ADMIN: 'Адміністратор',
  HR: 'Кадровик',
  DIRECTOR: 'Директор',
  VENDOR: 'Постачальник',
};

/** Roles the administrator can give in «Користувачі». */
export const ROLE_OPTIONS: SelectOption<UserRole>[] = [
  { value: 'HR', label: 'Кадровик', hint: 'веде облік: працівники, листи, звіти' },
  { value: 'DIRECTOR', label: 'Директор', hint: 'перегляд усього і підписання документів' },
  { value: 'ADMIN', label: 'Адміністратор', hint: 'ще й налаштування та користувачі' },
];
