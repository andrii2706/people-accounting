import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  UI_IDLE_ACTIVITY_EVENTS,
  UI_IDLE_ACTIVITY_KEY,
  UI_IDLE_SHARE_MS,
  UI_IDLE_SIGNED_OUT_KEY,
  UI_IDLE_TIMEOUT_MS,
  UI_IDLE_WARNING_MS,
} from '../constants/idle.constants';
import { uiIdleState } from '../utils/idle.utils';

export interface UiIdleOptions {
  /** Ends the session and leaves (to the portal, or to the sign-in of the portal itself). */
  expire: () => Promise<void> | void;
  timeoutMs?: number;
  warningMs?: number;
}

/**
 * The idle timeout of every application: 10 minutes without activity — the session ends. A minute before, a
 * countdown. The time is the clock, not the ticks: a laptop that slept or a tab that was in the background is checked
 * the moment it is back (visibility, focus, pageshow, and before the next frame), and the page is covered at once —
 * the old page never shows for a second before the redirect.
 */
@Injectable({ providedIn: 'root' })
export class UiIdleService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Seconds until the end while the countdown is shown; null otherwise. */
  readonly secondsLeft = signal<number | null>(null);
  /** The session is over: the cover is on, the application is leaving. */
  readonly ended = signal(false);

  private options: Required<UiIdleOptions> | null = null;
  private lastActivity = 0;
  private lastShared = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;

  private readonly onActivity = () => this.touch();
  private readonly onReturn = () => this.check();
  private readonly onStorage = (e: StorageEvent) => {
    if (e.key === UI_IDLE_ACTIVITY_KEY && e.newValue) {
      this.lastActivity = Math.max(this.lastActivity, Number(e.newValue) || 0);
      this.check();
    }
    if (e.key === UI_IDLE_SIGNED_OUT_KEY && e.newValue) void this.end(false);
  };

  start(options: UiIdleOptions): void {
    if (!this.browser || this.timer) return;
    this.options = { timeoutMs: UI_IDLE_TIMEOUT_MS, warningMs: UI_IDLE_WARNING_MS, ...options };
    this.ended.set(false);
    // the activity of the other applications of the domain counts too
    this.lastActivity = Math.max(Date.now() - 1000, this.shared());
    const win = this.document.defaultView!;
    for (const name of UI_IDLE_ACTIVITY_EVENTS) {
      win.addEventListener(name, this.onActivity, { capture: true, passive: true });
    }
    win.addEventListener('storage', this.onStorage);
    win.addEventListener('focus', this.onReturn);
    win.addEventListener('pageshow', this.onReturn);
    this.document.addEventListener('visibilitychange', this.onReturn);
    this.timer = setInterval(() => this.check(), 1000);
    this.watchFrames();
    this.touch();
  }

  stop(): void {
    if (!this.browser) return;
    const win = this.document.defaultView!;
    for (const name of UI_IDLE_ACTIVITY_EVENTS)
      win.removeEventListener(name, this.onActivity, { capture: true });
    win.removeEventListener('storage', this.onStorage);
    win.removeEventListener('focus', this.onReturn);
    win.removeEventListener('pageshow', this.onReturn);
    this.document.removeEventListener('visibilitychange', this.onReturn);
    if (this.timer) clearInterval(this.timer);
    if (this.frame) win.cancelAnimationFrame?.(this.frame);
    this.timer = null;
    this.frame = 0;
    this.secondsLeft.set(null);
  }

  /** «Залишитися» on the countdown — and every mouse / keyboard event. */
  touch(): void {
    if (this.ended()) return;
    // after a sleep the first event must not revive an expired session: check before counting it
    if (this.check()) return;
    const now = Date.now();
    this.lastActivity = now;
    if (this.secondsLeft() !== null) this.secondsLeft.set(null);
    if (now - this.lastShared > UI_IDLE_SHARE_MS) {
      this.lastShared = now;
      this.write(UI_IDLE_ACTIVITY_KEY, String(now));
    }
  }

  /** true — the session is over (and is being ended). */
  private check(): boolean {
    if (!this.options || this.ended()) return this.ended();
    const state = uiIdleState(
      Math.max(this.lastActivity, this.shared()),
      Date.now(),
      this.options.timeoutMs,
      this.options.warningMs,
    );
    if (state.ended) {
      void this.end(true);
      return true;
    }
    if (state.secondsLeft !== this.secondsLeft()) this.secondsLeft.set(state.secondsLeft);
    return false;
  }

  /** Before every frame while the page is visible: the cheap clock check that catches a wake-up before it paints. */
  private watchFrames() {
    const win = this.document.defaultView!;
    if (!win.requestAnimationFrame) return;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      // frames come every ~16 ms; a gap of seconds means the device slept or the tab was frozen
      if (now - last > 2000) this.check();
      last = now;
      if (this.timer) this.frame = win.requestAnimationFrame(loop);
    };
    this.frame = win.requestAnimationFrame(loop);
  }

  private async end(notifyTabs: boolean): Promise<void> {
    if (this.ended()) return;
    // the cover first — nothing of the page is seen any more
    this.ended.set(true);
    this.secondsLeft.set(null);
    const expire = this.options?.expire;
    this.stop();
    if (notifyTabs) this.write(UI_IDLE_SIGNED_OUT_KEY, String(Date.now()));
    await expire?.();
  }

  private shared(): number {
    try {
      return Number(this.document.defaultView?.localStorage.getItem(UI_IDLE_ACTIVITY_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.document.defaultView?.localStorage.setItem(key, value);
    } catch {
      // storage can be blocked (private mode) — the tab still works on its own
    }
  }
}
