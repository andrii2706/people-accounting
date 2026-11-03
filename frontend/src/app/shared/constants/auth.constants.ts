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
