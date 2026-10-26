import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DictionariesService } from '../services/dictionaries.service';

/** Довідники потрібні майже всім сторінкам — вантажимо один раз на рівні каркаса. */
export const dictionariesResolver: ResolveFn<void> = () =>
  // збій довідників не повинен блокувати весь застосунок: сторінки покажуть порожні списки,
  // а повторний запит відбудеться при наступній навігації
  inject(DictionariesService)
    .load()
    .pipe(catchError(() => of(undefined)));
