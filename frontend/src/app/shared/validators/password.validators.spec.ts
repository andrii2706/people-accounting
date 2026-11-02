import { PASSWORD_MIN_LENGTH, passwordProblems } from './password.validators';

describe('passwordProblems', () => {
  it('приймає надійний пароль', () => {
    expect(passwordProblems('Демо-Пароль-2026', 'hr@company.ua')).toEqual([]);
  });

  it('перелічує всі порушення', () => {
    expect(passwordProblems('abc')).toEqual([
      `щонайменше ${PASSWORD_MIN_LENGTH} символів`,
      'хоча б одна цифра',
    ]);
    expect(passwordProblems('123456789012')).toEqual(['хоча б одна літера']);
  });

  it('забороняє частину email у паролі', () => {
    expect(passwordProblems('Ivanenko-2026-x', 'ivanenko@company.ua')).toContain(
      'без частини email',
    );
    // short local parts are not checked — too many false positives
    expect(passwordProblems('Abcd-efgh-2026', 'ab@company.ua')).toEqual([]);
  });

  it('порожнє поле не перевіряє (про це скаже required)', () => {
    expect(passwordProblems('')).toEqual([]);
  });
});
