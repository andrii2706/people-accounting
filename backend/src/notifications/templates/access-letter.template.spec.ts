import { describe, expect, it } from 'vitest';
import { accessLetter } from './access-letter.template.js';

// fictitious people and company
const base = {
  fullName: 'Ольга ОБЛІКОВА',
  greetingName: 'Ольго',
  login: 'o.oblikova@example.com',
  temporaryPassword: 'Kx7mPq2RtW9vHn4L',
  expiresAt: new Date(Date.now() + 72 * 3_600_000),
  roleLabel: 'Кадровик',
  roleHint: 'облік працівників',
  kind: 'NEW' as const,
  asWhom: 'відповідальній особі за військовий облік',
  entityName: 'ТОВ «Приклад»',
  entityCode: '00000000',
  adminName: 'Андрій Зразковий',
  adminEmail: 'admin@example.com',
  appUrl: 'https://oblik.example.com',
};

describe('лист з тимчасовим паролем', () => {
  it('новий доступ: тема, звернення, логін, пароль, строк — у HTML і в тексті', () => {
    const l = accessLetter(base);
    expect(l.subject).toBe('Доступ до системи військового обліку — ТОВ «Приклад»');
    for (const part of [l.text, l.html!]) {
      expect(part).toContain('Добрий день, Ольго!');
      expect(part).toContain('o.oblikova@example.com');
      expect(part).toContain('Kx7mPq2RtW9vHn4L');
      expect(part).toMatch(/Діє до .*\(72 год\.\)/);
    }
    expect(l.text).toContain('як відповідальній особі за військовий облік');
    expect(l.html).toContain('href="https://oblik.example.com/login"');
  });

  it('скидання пароля — інша тема й вступ', () => {
    const l = accessLetter({ ...base, kind: 'RESET' });
    expect(l.subject).toContain('Новий тимчасовий пароль');
    expect(l.text).toContain('скинув пароль');
  });

  it('HTML екранується', () => {
    const l = accessLetter({ ...base, entityName: 'ТОВ <script>alert(1)</script>', greetingName: '' });
    expect(l.html).not.toContain('<script>');
    expect(l.html).toContain('&lt;script&gt;');
    expect(l.text).toContain('Добрий день, Ольга ОБЛІКОВА!');
  });

  it('обліковий запис «Адміністратор» без імені — «Адміністратор системи»', () => {
    expect(accessLetter({ ...base, adminName: 'Адміністратор' }).text).toContain('Адміністратор системи надав');
    expect(accessLetter(base).text).toContain('Адміністратор Андрій Зразковий надав');
  });
});
