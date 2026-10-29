import { describe, expect, it } from 'vitest';
import { htmlToText, parseMobilizationTerm } from './decree-parser.js';

describe('mobilization decree parser', () => {
  it('takes the latest extension from the consolidated text of Decree 65/2022', () => {
    const html = `<p>3. Мобілізація проводиться протягом 90 діб із дня набрання чинності цим Указом.</p>
      <p>{Строк проведення загальної мобілізації продовжено з 5 травня 2026 року на 90 діб згідно з Указом Президента
      № 343/2026 від 15.04.2026}</p>
      <p>{Строк проведення загальної мобілізації продовжено з 2&nbsp;серпня 2026 року на 90 діб згідно з Указом Президента
      № 597/2026 від 13.07.2026}</p>`;
    expect(parseMobilizationTerm(htmlToText(html))).toEqual({
      from: '2026-08-02',
      days: 90,
      until: '2026-10-31',
      decree: '№ 597/2026 від 13.07.2026',
    });
  });

  it('reads the wording of an extension decree', () => {
    const text = 'продовжити з 31 жовтня 2026 року строк проведення загальної мобілізації на 90 діб.';
    expect(parseMobilizationTerm(text)?.until).toBe('2027-01-29');
  });

  it('returns null when there is nothing to read', () => {
    expect(parseMobilizationTerm('Сторінку не знайдено')).toBeNull();
  });
});
