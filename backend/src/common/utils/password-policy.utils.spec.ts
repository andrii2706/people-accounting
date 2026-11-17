import { describe, expect, it } from 'vitest';
import { HANDED_OVER_PASSWORD_PROBLEM } from '../constants/auth.constants.js';
import { passwordProblems, temporaryPasswordProblems } from './password-policy.utils.js';

describe('тимчасовий пароль, який адміністратор вводить для користувача', () => {
  it('латиниця, цифри й символи — приймається', () => {
    expect(temporaryPasswordProblems('Sonyah#Lis2026q', 'olena@example.test')).toEqual([]);
  });

  it('кирилична «а» замість латинської — у листі не відрізнити, тож відмова', () => {
    // «Sonyаh#Lis2026q» — the 5th letter is the Cyrillic «а» (U+0430)
    expect(temporaryPasswordProblems('Sonyаh#Lis2026q')).toContain(HANDED_OVER_PASSWORD_PROBLEM);
    // the user's own password may be in Ukrainian — he types it himself
    expect(passwordProblems('Sonyаh#Lis2026q')).toEqual([]);
  });

  it('пробіл на початку, в кінці чи всередині — відмова', () => {
    for (const p of [' Sonyah#Lis2026q', 'Sonyah#Lis2026q ', 'Sonyah Lis2026q'])
      expect(temporaryPasswordProblems(p)).toContain(HANDED_OVER_PASSWORD_PROBLEM);
  });

  it('звичайні вимоги політики лишаються', () => {
    expect(temporaryPasswordProblems('short1')).toContain('щонайменше 12 символів');
  });
});
