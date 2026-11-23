/** What a snackbar tells: done, for your information, mind this, failed. */
export type ToastKind = 'success' | 'info' | 'warning' | 'error';

/** The one action of a snackbar: a link (href) or a step (run), e.g. «Відкрити», «Скасувати», «Повторити». */
export interface ToastAction {
  label: string;
  run?: () => unknown;
  href?: string;
}

export interface ToastOptions {
  action?: ToastAction;
  /** Milliseconds on the screen; null — until it is closed. By default: see TOAST_DURATIONS. */
  duration?: number | null;
}

/** A snackbar on the screen. */
export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  action?: ToastAction;
  /** null — stays until closed. */
  duration: number | null;
  /** «Скасувати» with the ring of the time left. */
  undo: boolean;
  /** The pointer is over it: the time stands. */
  paused: boolean;
}
