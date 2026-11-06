import { describe, expect, it } from 'vitest';
import { passwordExpiresAt } from '../../common/utils/password-policy.utils.js';
import { passwordChangeLetter, passwordExpiringLetter } from './password-letters.template.js';

// fictitious people and company
const common = {
  fullName: 'Ольга ОБЛІКОВА',
  greetingName: 'Ольго',
  login: 'o.oblikova@example.com',
  link: 'https://oblik.example.com/reset-password?token=abc',
  linkExpiresAt: new Date(Date.now() + 7 * 86_400_000),
  appUrl: 'https://oblik.example.com',
  entityName: 'ТОВ «Приклад»',
  entityCode: '00000000',
};

describe('листи про пароль', () => {
  it('1 — нагадування за місяць: дата, кнопка зміни, пароль ще діє', () => {
    const l = passwordExpiringLetter({ ...common, expiresAt: new Date(Date.now() + 30 * 86_400_000) });
    expect(l.subject).toMatch(/^Пароль до військового обліку спливає \d{2}\.\d{2}\.\d{4}$/);
    expect(l.text).toContain('залишилось 30 дн.');
    expect(l.text).toContain(common.link);
    expect(l.html).toContain('>Змінити пароль</a>');
    expect(l.html).toContain('href="https://oblik.example.com/reset-password?token=abc"');
  });

  it('2 — запит адміністратора: хто попросив, кнопка, контакт', () => {
    const l = passwordChangeLetter({ ...common, adminName: 'Андрій Зразковий', adminEmail: 'admin@example.com' });
    expect(l.subject).toBe('Змініть пароль до військового обліку — ТОВ «Приклад»');
    expect(l.text).toContain('Адміністратор Андрій Зразковий попросив вас змінити пароль');
    expect(l.html).toContain('>Задати новий пароль</a>');
    expect(l.html).toContain('mailto:admin@example.com');
  });
});

describe('строк дії пароля', () => {
  const changed = new Date('2026-01-10T10:00:00Z');
  it('кадровик і директор — півроку від зміни', () => {
    expect(passwordExpiresAt({ role: 'HR', passwordChangedAt: changed }, 180, ['HR', 'DIRECTOR'])?.toISOString()).toBe(
      '2026-07-09T10:00:00.000Z',
    );
    expect(passwordExpiresAt({ role: 'DIRECTOR', passwordChangedAt: changed }, 180, ['HR', 'DIRECTOR'])).not.toBeNull();
  });
  it('адміністратор, невідома дата зміни або 0 днів — без обмеження', () => {
    expect(passwordExpiresAt({ role: 'ADMIN', passwordChangedAt: changed }, 180, ['HR', 'DIRECTOR'])).toBeNull();
    expect(passwordExpiresAt({ role: 'HR', passwordChangedAt: null }, 180, ['HR'])).toBeNull();
    expect(passwordExpiresAt({ role: 'HR', passwordChangedAt: changed }, 0, ['HR'])).toBeNull();
  });
});
