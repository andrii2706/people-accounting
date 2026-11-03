import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError, ApiFieldError, BoundApiErrors } from '../interfaces/common.interface';

/** What to tell the user when the server gave no text of its own. */
const STATUS_MESSAGES: Record<number, string> = {
  0: 'Немає зв’язку із сервером — перевірте інтернет і спробуйте ще раз',
  400: 'Дані не прийнято — перевірте заповнені поля',
  401: 'Сесія завершилась — увійдіть знову',
  403: 'Недостатньо прав для цієї дії',
  404: 'Запис не знайдено — можливо, його вже видалили',
  408: 'Сервер довго не відповідає — спробуйте ще раз',
  409: 'Дані змінилися або вже існують — оновіть сторінку й спробуйте ще раз',
  413: 'Завеликий файл або запит',
  415: 'Непідтримуваний формат файлу',
  429: 'Забагато спроб — зачекайте хвилину',
};
const SERVER_ERROR =
  'Помилка на сервері — спробуйте пізніше. Якщо повторюється, зверніться до адміністратора';

const hasCyrillic = (s: string) => /[а-яіїєґ]/i.test(s);

function body(error: unknown): ApiError | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const b = error.error as unknown;
  return b && typeof b === 'object' ? (b as ApiError) : null;
}

/** Errors bound to request fields (400 of the ValidationPipe or of a service). */
export function apiFieldErrors(error: unknown): ApiFieldError[] {
  return body(error)?.errors ?? [];
}

/** «Телефон: Некоректний формат» — when the field is not on the screen, its name says where to look. */
export function fieldErrorLine(e: ApiFieldError): string {
  return e.label ? `${e.label}: ${e.message}` : e.message;
}

/** Status of an HTTP error (0 — no connection), or null for any other error. */
export function apiErrorStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

/**
 * A sentence for a toast or an error line under a form. Order: the server's own texts in Ukrainian
 * (validation lines with field names, «Такий РНОКПП уже є»), then a text by status, then `fallback`.
 */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Сталася помилка. Спробуйте ще раз.',
): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return STATUS_MESSAGES[0]!;

  const b = body(error);
  if (b?.errors?.length) return [...new Set(b.errors.map(fieldErrorLine))].join('; ');
  const lines = (Array.isArray(b?.message) ? b.message : [b?.message ?? '']).filter(
    (m): m is string => typeof m === 'string' && hasCyrillic(m),
  );
  if (lines.length) return [...new Set(lines)].join('; ');

  if (error.status >= 500) return SERVER_ERROR;
  return STATUS_MESSAGES[error.status] ?? fallback;
}

/**
 * Puts API field errors under the fields of a Signal Forms tree — return `fieldErrors` from the
 * `submit()` action. Errors of fields the form does not have go to `unmatched` (with field names).
 *
 * `resolve` maps an API path to a form path when they differ ("validTo" → ["until"]).
 */
export function bindApiErrors<E = never>(
  error: unknown,
  tree: unknown,
  resolve: (field: string) => string[] = (field) => field.split('.'),
): BoundApiErrors<E> {
  const list = apiFieldErrors(error);
  if (!list.length) return { fieldErrors: [], unmatched: [apiErrorMessage(error)] };
  const fieldErrors: E[] = [];
  const unmatched: string[] = [];
  for (const e of list) {
    let node: unknown = tree;
    for (const segment of resolve(e.field)) {
      node = (node as Record<string, unknown> | undefined)?.[
        /^\d+$/.test(segment) ? Number(segment) : segment
      ];
    }
    if (typeof node === 'function')
      fieldErrors.push({ fieldTree: node, kind: 'server', message: e.message } as E);
    else unmatched.push(fieldErrorLine(e));
  }
  return { fieldErrors, unmatched: [...new Set(unmatched)] };
}

/**
 * For a `submit()` action: API errors go under the form fields, the rest — into `notify` (a toast).
 * Returns what the action should return (field errors or undefined).
 */
export function formSubmitErrors<E = never>(
  error: unknown,
  tree: unknown,
  notify: (message: string) => void,
  resolve?: (field: string) => string[],
): E[] | undefined {
  const { fieldErrors, unmatched } = bindApiErrors<E>(error, tree, resolve);
  if (unmatched.length) notify(unmatched.join('\n'));
  else if (fieldErrors.length) notify('Не збережено — виправте позначені поля');
  return fieldErrors.length ? fieldErrors : undefined;
}
