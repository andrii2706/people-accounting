import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error.utils';

const httpError = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('apiErrorMessage', () => {
  it('бере тексти структурованих помилок без повторів і без назв полів', () => {
    const error = httpError(400, {
      errors: [
        { field: 'rnokpp', message: 'РНОКПП — 10 цифр' },
        { field: 'militaryDocuments.0.number', message: 'РНОКПП — 10 цифр' },
        { field: 'vos', message: 'ВОС — 3 або 6 цифр' },
      ],
    });
    expect(apiErrorMessage(error)).toBe('РНОКПП — 10 цифр; ВОС — 3 або 6 цифр');
  });

  it('підтримує message рядком і масивом (формат NestJS)', () => {
    expect(apiErrorMessage(httpError(409, { message: 'Такий РНОКПП уже є' }))).toBe(
      'Такий РНОКПП уже є',
    );
    expect(apiErrorMessage(httpError(400, { message: ['a', 'b'] }))).toBe('a; b');
  });

  it('пояснює, що сервер недоступний', () => {
    expect(apiErrorMessage(httpError(0, null))).toContain('Сервер недоступний');
  });

  it('для будь-чого іншого — запасний текст', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe('Сталася помилка. Спробуйте ще раз.');
    expect(apiErrorMessage(httpError(500, null), 'Не вдалося')).toBe('Не вдалося');
  });
});
