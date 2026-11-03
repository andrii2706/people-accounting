import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Sign-out after this long without mouse or keyboard activity. */
export const IDLE_TIMEOUT_MS = 10 * 60_000;
/** The warning with a countdown appears this long before the sign-out. */
export const IDLE_WARNING_MS = 60_000;

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const;
/** Activity and sign-out are shared between tabs: working in one tab keeps the others signed in. */
const ACTIVITY_KEY = 'mr.lastActivity';
const SIGNED_OUT_KEY = 'mr.idleSignedOut';

/**
 * Idle timeout: when the user does not move the mouse or press keys for 10 minutes, the session is ended
 * and the login page opens (with a return to the same page). A minute before that a countdown is shown.
 * Time is measured by the clock, not by timer ticks, so a sleeping laptop or a background tab
 * is signed out right after it wakes up.
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Seconds until the sign-out while the warning is shown; null otherwise. */
  readonly secondsLeft = signal<number | null>(null);

  private lastActivity = 0;
  private lastShared = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private signingOut = false;

  private readonly onActivity = () => this.touch();
  private readonly onStorage = (e: StorageEvent) => {
    if (e.key === ACTIVITY_KEY && e.newValue) {
      this.lastActivity = Math.max(this.lastActivity, Number(e.newValue) || 0);
      this.check();
    }
    if (e.key === SIGNED_OUT_KEY && e.newValue) void this.signOut(false);
  };

  start(): void {
    if (!this.isBrowser || this.timer) return;
    const win = this.document.defaultView!;
    this.signingOut = false;
    this.lastActivity = Date.now();
    for (const name of ACTIVITY_EVENTS) {
      win.addEventListener(name, this.onActivity, { capture: true, passive: true });
    }
    win.addEventListener('storage', this.onStorage);
    this.timer = setInterval(() => this.check(), 1000);
  }

  stop(): void {
    if (!this.isBrowser) return;
    const win = this.document.defaultView!;
    for (const name of ACTIVITY_EVENTS)
      win.removeEventListener(name, this.onActivity, { capture: true });
    win.removeEventListener('storage', this.onStorage);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.secondsLeft.set(null);
  }

  /** «Залишитися в системі» on the warning — and every mouse / keyboard event. */
  touch(): void {
    if (this.signingOut) return;
    const now = Date.now();
    this.lastActivity = now;
    if (this.secondsLeft() !== null) this.secondsLeft.set(null);
    // tell the other tabs, but not on every mouse move
    if (now - this.lastShared > 5000) {
      this.lastShared = now;
      this.share(ACTIVITY_KEY, String(now));
    }
  }

  private check(): void {
    if (this.signingOut) return;
    const left = IDLE_TIMEOUT_MS - (Date.now() - this.lastActivity);
    if (left <= 0) void this.signOut(true);
    else if (left <= IDLE_WARNING_MS) this.secondsLeft.set(Math.ceil(left / 1000));
    else if (this.secondsLeft() !== null) this.secondsLeft.set(null);
  }

  private async signOut(notifyTabs: boolean): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    const returnUrl = this.router.url;
    this.stop();
    if (notifyTabs) this.share(SIGNED_OUT_KEY, String(Date.now()));
    await this.auth.logout({ reason: 'idle', returnUrl });
  }

  private share(key: string, value: string): void {
    try {
      this.document.defaultView?.localStorage.setItem(key, value);
    } catch {
      // storage can be blocked (private mode) — the tab still works on its own
    }
  }
}
