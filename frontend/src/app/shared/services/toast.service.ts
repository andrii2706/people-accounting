import { Injectable, signal } from '@angular/core';
import {
  TOAST_ACTION_DURATION,
  TOAST_DURATIONS,
  TOAST_LIMIT,
  TOAST_UNDO_LABEL,
} from '../constants/toast.constants';
import type { Toast, ToastKind, ToastOptions } from '../interfaces/toast.interface';

/** The clock of a snackbar: when it started and how much is left. */
interface ToastTimer {
  handle: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  remaining: number;
}

/**
 * Snackbars: a short dark message at the bottom after an action — what happened and, when needed, one action
 * («Відкрити», «Скасувати», «Повторити»). Errors stay until they are closed; the others go by themselves; the time
 * stands while the pointer is over one. Field errors of a form stay next to the fields — not here.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly timers = new Map<number, ToastTimer>();
  private readonly _toasts = signal<Toast[]>([]);
  /** Newest first. */
  readonly toasts = this._toasts.asReadonly();

  success(text: string, options?: ToastOptions) {
    return this.show('success', text, options);
  }

  info(text: string, options?: ToastOptions) {
    return this.show('info', text, options);
  }

  warning(text: string, options?: ToastOptions) {
    return this.show('warning', text, options);
  }

  error(text: string, options?: ToastOptions) {
    return this.show('error', text, options);
  }

  /** Done, and it can be taken back: «Скасувати» for 7 s, the ring shows the time left. */
  undoable(text: string, undo: () => unknown) {
    return this.push(
      'success',
      text,
      { action: { label: TOAST_UNDO_LABEL, run: undo }, duration: TOAST_ACTION_DURATION },
      true,
    );
  }

  show(kind: ToastKind, text: string, options: ToastOptions = {}) {
    return this.push(kind, text, options, false);
  }

  dismiss(id: number) {
    const timer = this.timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** The action of a snackbar: its step, then the snackbar goes. */
  act(toast: Toast) {
    this.dismiss(toast.id);
    void toast.action?.run?.();
  }

  /** The pointer came over it: the time stands. */
  pause(id: number) {
    const timer = this.timers.get(id);
    if (!timer?.handle) return;
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining -= Date.now() - timer.startedAt;
    this.mark(id, true);
  }

  resume(id: number) {
    const timer = this.timers.get(id);
    if (!timer || timer.handle) return;
    this.start(id, timer, Math.max(1200, timer.remaining));
    this.mark(id, false);
  }

  private push(kind: ToastKind, text: string, options: ToastOptions, undo: boolean) {
    const id = ++this.seq;
    const fallback = options.action
      ? Math.max(TOAST_ACTION_DURATION, TOAST_DURATIONS[kind] ?? 0)
      : TOAST_DURATIONS[kind];
    const duration =
      options.duration !== undefined ? options.duration : kind === 'error' ? null : fallback;
    const toast: Toast = { id, kind, text, action: options.action, duration, undo, paused: false };
    const list = [toast, ...this._toasts()];
    for (const old of list.slice(TOAST_LIMIT)) this.dismiss(old.id);
    this._toasts.set(list.slice(0, TOAST_LIMIT));
    if (duration !== null && typeof window !== 'undefined') {
      this.start(id, { handle: null, startedAt: 0, remaining: duration }, duration);
    }
    return id;
  }

  private start(id: number, timer: ToastTimer, ms: number) {
    timer.startedAt = Date.now();
    timer.remaining = ms;
    timer.handle = setTimeout(() => this.dismiss(id), ms);
    this.timers.set(id, timer);
  }

  private mark(id: number, paused: boolean) {
    this._toasts.update((list) => list.map((t) => (t.id === id ? { ...t, paused } : t)));
  }
}
