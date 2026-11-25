import { DestroyRef, effect, inject, signal, untracked, type Signal } from '@angular/core';
import { LOADING_DELAY_MS, LOADING_MIN_MS } from '../constants/loading.constants';

/**
 * Whether a loader is to be seen: `busy` turns on → the loader appears after `delay` ms (a fast answer shows nothing);
 * once seen it stays at least `min` ms. Call in an injection context (a field of a component).
 */
export function delayedBusy(
  busy: Signal<boolean>,
  delay = LOADING_DELAY_MS,
  min = LOADING_MIN_MS,
): Signal<boolean> {
  const visible = signal(false);
  let shownAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  effect(() => {
    const on = busy();
    untracked(() => {
      clear();
      if (on) {
        if (visible()) return;
        timer = setTimeout(() => {
          shownAt = Date.now();
          visible.set(true);
        }, delay);
      } else if (visible()) {
        const left = min - (Date.now() - shownAt);
        if (left <= 0) visible.set(false);
        else timer = setTimeout(() => visible.set(false), left);
      }
    });
  });
  inject(DestroyRef).onDestroy(clear);
  return visible.asReadonly();
}
