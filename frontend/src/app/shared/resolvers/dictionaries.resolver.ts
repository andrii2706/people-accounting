import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DictionariesService } from '../services/dictionaries.service';

/** Dictionaries are needed by almost every page — loaded once at the shell level. */
export const dictionariesResolver: ResolveFn<void> = () =>
  // a dictionaries failure must not block the whole app: pages show empty lists,
  // and the request is retried on the next navigation
  inject(DictionariesService)
    .load()
    .pipe(catchError(() => of(undefined)));
