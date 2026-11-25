import { UI_IDLE_PORTAL } from '../constants/idle.constants';

/** What the idle clock says: the session is over, the countdown is on (seconds left), or all is well. */
export function uiIdleState(
  lastActivity: number,
  now: number,
  timeoutMs: number,
  warningMs: number,
): { ended: true } | { ended: false; secondsLeft: number | null } {
  const left = timeoutMs - (now - lastActivity);
  if (left <= 0) return { ended: true };
  return { ended: false, secondsLeft: left <= warningMs ? Math.ceil(left / 1000) : null };
}

/**
 * The address of the portal after the idle sign-out of an application: the portal tells why, and after a new
 * sign-in brings the person back to `next` (a page of this domain only).
 */
export function uiIdlePortalUrl(app: string, next: string): string {
  const params = new URLSearchParams({ idle: app });
  if (next.startsWith('/') && !next.startsWith('//')) params.set('next', next);
  return `${UI_IDLE_PORTAL}?${params.toString()}`;
}
