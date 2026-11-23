import { describe, expect, it } from 'vitest';
import { DEFAULT_LETTERHEAD_SETTINGS } from '../constants/letterhead.constants';
import {
  letterheadAddress,
  letterheadCode,
  letterheadContent,
  letterheadRows,
  missingRequisites,
} from './letterhead.utils';

const org = {
  fullName: 'Товариство з обмеженою відповідальністю «Вигадана компанія»',
  shortName: 'ТОВ «Вигадана компанія»',
  address: 'м. Львів, вул. Зразкова, 10',
  postalCode: '79000',
  edrpou: '12345678',
  phone: '(032) 111-22-33',
  email: '',
};

describe('letterhead utils', () => {
  it('prints the same lines as the server', () => {
    const c = letterheadContent(org, DEFAULT_LETTERHEAD_SETTINGS);
    expect(c.title).toBe(org.fullName);
    expect(letterheadRows(c)).toEqual([
      ['79000, м. Львів, вул. Зразкова, 10', 'Код ЄДР 12345678'],
      ['Тел. (032) 111-22-33', ''],
    ]);
  });

  it('the index once, the code of a person', () => {
    expect(letterheadAddress('79033, м. Львів', '')).toBe('79033, м. Львів');
    expect(letterheadCode('1234567890')).toBe('РНОКПП 1234567890');
  });

  it('tells which shown requisites are empty', () => {
    expect(missingRequisites(org, DEFAULT_LETTERHEAD_SETTINGS)).toEqual(['email']);
    expect(missingRequisites(org, { ...DEFAULT_LETTERHEAD_SETTINGS, showEmail: false })).toEqual(
      [],
    );
  });
});
