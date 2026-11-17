import { HANDED_OVER_PASSWORD_PROBLEM } from '../constants/auth.constants';
import { temporaryPasswordProblems } from '../validators/password.validators';
import { temporaryPasswordExpired } from './user-policy.utils';

describe('тимчасовий пароль від адміністратора', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');

  it('прострочений — старий пароль уже не відкриває обліковий запис', () => {
    const user = { mustChangePassword: true, temporaryPasswordExpiresAt: '2026-11-17T11:00:00Z' };
    expect(temporaryPasswordExpired(user, now)).toBe(true);
    expect(
      temporaryPasswordExpired(
        { ...user, temporaryPasswordExpiresAt: '2026-11-18T11:00:00Z' },
        now,
      ),
    ).toBe(false);
  });

  it('пароль уже змінено користувачем або строку немає — не прострочений', () => {
    expect(
      temporaryPasswordExpired(
        { mustChangePassword: false, temporaryPasswordExpiresAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      temporaryPasswordExpired({ mustChangePassword: true, temporaryPasswordExpiresAt: null }, now),
    ).toBe(false);
  });

  it('у полі «Тимчасовий пароль» — лише латиниця без пробілів', () => {
    expect(temporaryPasswordProblems('Sonyah#Lis2026q')).toEqual([]);
    expect(temporaryPasswordProblems('Sonyаh#Lis2026q')).toContain(HANDED_OVER_PASSWORD_PROBLEM);
    expect(temporaryPasswordProblems('Sonyah#Lis2026q ')).toContain(HANDED_OVER_PASSWORD_PROBLEM);
  });
});
