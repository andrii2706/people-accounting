/** No mouse, keys, touch or scroll so long — the session ends (in every application of the domain at once). */
export const UI_IDLE_TIMEOUT_MS = 10 * 60_000;
/** The countdown shows this long before. */
export const UI_IDLE_WARNING_MS = 60_000;
/** What counts as activity. */
export const UI_IDLE_ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const;
/**
 * The last activity, shared by every tab and every application of the domain (one origin — one localStorage):
 * work in «Облік працівників» keeps «Військовий облік» in the next tab alive too.
 */
export const UI_IDLE_ACTIVITY_KEY = 'mr.lastActivity';
/** Set when a tab ends the session on idle — the other tabs follow at once. */
export const UI_IDLE_SIGNED_OUT_KEY = 'mr.idleSignedOut';
/** The activity is written for the other tabs at most so often. */
export const UI_IDLE_SHARE_MS = 5000;
/** The portal: where an application sends the person after the idle sign-out (`?idle=<app>&next=<page>`). */
export const UI_IDLE_PORTAL = '/';
