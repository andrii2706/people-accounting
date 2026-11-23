import { describe, expect, it } from 'vitest';
import { DEFAULT_LETTERHEAD_SETTINGS } from '../letterhead.constants.js';
import {
  letterheadAddress,
  letterheadCode,
  letterheadContent,
  letterheadHeight,
  letterheadRows,
  withLetterheadDefaults,
} from './letterhead.utils.js';

const org = {
  fullName: 'Товариство з обмеженою відповідальністю «Вигадана компанія»',
  shortName: 'ТОВ «Вигадана компанія»',
  address: 'м. Львів, вул. Зразкова, 10, оф. 5',
  postalCode: '79000',
  edrpou: '12345678',
  phone: '(032) 111-22-33',
  email: 'office@example.com',
};

describe('letterhead', () => {
  it('fills an older or broken set with the defaults', () => {
    expect(withLetterheadDefaults(null)).toEqual(DEFAULT_LETTERHEAD_SETTINGS);
    const s = withLetterheadDefaults({ titleSize: 99, font: 'Comic Sans' as never, extraLine: '  сайт  ' });
    expect(s.titleSize).toBe(28);
    expect(s.font).toBe('Arial');
    expect(s.extraLine).toBe('сайт');
  });

  it('puts the index first, once', () => {
    expect(letterheadAddress('м. Львів, вул. Зразкова, 10', '79000')).toBe('79000, м. Львів, вул. Зразкова, 10');
    expect(letterheadAddress('79033, м. Львів, вул. Шевченка, 27', '')).toBe('79033, м. Львів, вул. Шевченка, 27');
    expect(letterheadAddress('79033, м. Львів', '79033')).toBe('79033, м. Львів');
  });

  it('names the code of a company and of a person', () => {
    expect(letterheadCode('12345678')).toBe('Код ЄДР 12345678');
    expect(letterheadCode('1234567890')).toBe('РНОКПП 1234567890');
    expect(letterheadCode('')).toBe('');
  });

  it('is made of the requisites, with what the company chose to show', () => {
    const c = letterheadContent(org, DEFAULT_LETTERHEAD_SETTINGS);
    expect(c).toEqual({
      title: org.fullName,
      address: '79000, м. Львів, вул. Зразкова, 10, оф. 5',
      code: 'Код ЄДР 12345678',
      contacts: 'Тел. (032) 111-22-33, E-mail: office@example.com',
      extra: '',
    });
    expect(letterheadRows(c)).toEqual([
      [c.address, c.code],
      [c.contacts, ''],
    ]);
    const short = letterheadContent(org, { ...DEFAULT_LETTERHEAD_SETTINGS, title: 'SHORT', showEmail: false });
    expect(short.title).toBe(org.shortName);
    expect(short.contacts).toBe('Тел. (032) 111-22-33');
    const own = letterheadContent(org, { ...DEFAULT_LETTERHEAD_SETTINGS, title: 'CUSTOM', customTitle: 'ВИГАДАНА' });
    expect(own.title).toBe('ВИГАДАНА');
  });

  it('leaves out what is empty — no blank for the pen on a letterhead', () => {
    const c = letterheadContent(
      { ...org, phone: '', email: '' },
      { ...DEFAULT_LETTERHEAD_SETTINGS, extraLine: 'www.example.com' },
    );
    expect(letterheadRows(c)).toEqual([
      [c.address, c.code],
      ['www.example.com', ''],
    ]);
    const none = letterheadContent(org, {
      ...DEFAULT_LETTERHEAD_SETTINGS,
      showAddress: false,
      showPhone: false,
      showEmail: false,
    });
    expect(letterheadRows(none)).toEqual([['', 'Код ЄДР 12345678']]);
  });

  it('a longer name takes more room on the sheet', () => {
    const c = letterheadContent(org, DEFAULT_LETTERHEAD_SETTINGS);
    const big = letterheadHeight(c, { ...DEFAULT_LETTERHEAD_SETTINGS, titleSize: 28 }, 9355);
    expect(big).toBeGreaterThan(letterheadHeight(c, DEFAULT_LETTERHEAD_SETTINGS, 9355));
  });
});
