import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage, bindApiErrors } from './api-error.utils';

const httpError = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('apiErrorMessage', () => {
  it('бере структуровані помилки з назвами полів і без повторів', () => {
    const error = httpError(400, {
      errors: [
        { field: 'rnokpp', label: 'РНОКПП', message: 'РНОКПП — 10 цифр' },
        { field: 'rnokpp', label: 'РНОКПП', message: 'РНОКПП — 10 цифр' },
        { field: 'vos', message: 'ВОС — 3 або 6 цифр' },
      ],
    });
    expect(apiErrorMessage(error)).toBe('РНОКПП: РНОКПП — 10 цифр; ВОС — 3 або 6 цифр');
  });

  it('підтримує message рядком і масивом (формат NestJS)', () => {
    expect(apiErrorMessage(httpError(409, { message: 'Такий РНОКПП уже є' }))).toBe(
      'Такий РНОКПП уже є',
    );
    expect(apiErrorMessage(httpError(400, { message: ['Поле а', 'Поле б'] }))).toBe(
      'Поле а; Поле б',
    );
  });

  it('технічні англійські тексти замінює зрозумілими за статусом', () => {
    expect(apiErrorMessage(httpError(0, null))).toContain('Немає зв’язку');
    expect(apiErrorMessage(httpError(403, { message: 'Forbidden resource' }))).toBe(
      'Недостатньо прав для цієї дії',
    );
    expect(apiErrorMessage(httpError(429, { message: 'ThrottlerException' }))).toContain(
      'зачекайте',
    );
    expect(apiErrorMessage(httpError(502, '<html>Bad gateway</html>'))).toContain(
      'Помилка на сервері',
    );
  });

  it('для не-HTTP помилок — запасний текст', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe('Сталася помилка. Спробуйте ще раз.');
    expect(apiErrorMessage(new Error('boom'), 'Не вдалося')).toBe('Не вдалося');
  });
});

describe('bindApiErrors', () => {
  const field = () => ({});
  const tree = { phone: field, docs: [{ number: field }] };

  it('розкладає помилки під поля форми, решту — окремо з назвами полів', () => {
    const r = bindApiErrors<{ fieldTree: unknown; message: string }>(
      httpError(400, {
        errors: [
          { field: 'phone', label: 'Телефон', message: 'Некоректний формат' },
          { field: 'docs.0.number', label: 'Документ 1 — Номер', message: 'Лише цифри' },
          { field: 'id', label: 'id', message: 'Це поле не можна змінювати тут' },
        ],
      }),
      tree,
    );
    expect(r.fieldErrors.map((e) => e.message)).toEqual(['Некоректний формат', 'Лише цифри']);
    expect(r.fieldErrors[1]!.fieldTree).toBe(field);
    expect(r.unmatched).toEqual(['id: Це поле не можна змінювати тут']);
  });

  it('без errors — одне загальне повідомлення', () => {
    const r = bindApiErrors(httpError(409, { message: 'Такий email уже є' }), tree);
    expect(r).toEqual({ fieldErrors: [], unmatched: ['Такий email уже є'] });
  });
});
