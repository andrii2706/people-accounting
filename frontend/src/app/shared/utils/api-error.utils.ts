import { HttpErrorResponse } from '@angular/common/http';

/** Human-friendly message from an API error (NestJS returns message: string | string[]). */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Сталася помилка. Спробуйте ще раз.',
): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Сервер недоступний. Перевірте з’єднання.';
    const body = error.error as {
      message?: string | string[];
      errors?: { field: string; message: string }[];
    } | null;
    // structured validation errors — texts only, without technical field names
    if (body?.errors?.length) return [...new Set(body.errors.map((e) => e.message))].join('; ');
    const message = body?.message;
    if (Array.isArray(message)) return message.join('; ');
    if (message) return message;
  }
  return fallback;
}
