import { Injectable, signal } from '@angular/core';
import type {
  ConfirmOptions,
  ConfirmRequest,
  UnsavedChoice,
  UnsavedOptions,
} from '../interfaces/confirm.interface';

/**
 * Questions in a modal window of the application instead of the grey window of the browser (window.confirm): the
 * question, what follows, buttons named by the action. `await confirm(…)` — true when the action is chosen;
 * Esc, a click outside or «Скасувати» — false. One question at a time: a new one answers the old with «no».
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _request = signal<ConfirmRequest | null>(null);
  readonly request = this._request.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.replace({ kind: 'confirm', confirm: options, resolve: (a) => resolve(a === true) });
    });
  }

  /** Leaving a page with changes: «Зберегти», «Не зберігати» or «Залишитися». */
  unsaved(options: UnsavedOptions): Promise<UnsavedChoice> {
    return new Promise<UnsavedChoice>((resolve) => {
      this.replace({
        kind: 'unsaved',
        unsaved: options,
        resolve: (a) => resolve(typeof a === 'string' ? a : 'stay'),
      });
    });
  }

  /** The answer of the window (the host calls it). */
  answer(value: boolean | UnsavedChoice) {
    const request = this._request();
    if (!request) return;
    this._request.set(null);
    request.resolve(value);
  }

  private replace(next: ConfirmRequest) {
    const old = this._request();
    if (old) old.resolve(old.kind === 'confirm' ? false : 'stay');
    this._request.set(next);
  }
}
