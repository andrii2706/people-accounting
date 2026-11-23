import type { ToastKind } from '../interfaces/toast.interface';

/** How long a snackbar stays, ms; null — until it is closed (an error must be read). */
export const TOAST_DURATIONS: Record<ToastKind, number | null> = {
  success: 4000,
  info: 4000,
  warning: 7000,
  error: null,
};

/** With an action there is time to press it. */
export const TOAST_ACTION_DURATION = 7000;

/** At most on the screen at once; a new one pushes out the oldest. */
export const TOAST_LIMIT = 3;

/** The label of the action that takes the step back. */
export const TOAST_UNDO_LABEL = 'Скасувати';
