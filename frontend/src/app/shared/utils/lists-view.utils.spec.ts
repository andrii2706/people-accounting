import type { ListRow, ListRowStatus } from '../interfaces/report.interface';
import {
  extractCount,
  filterRows,
  groupsOfSections,
  maskTaxNumber,
  matchesSearch,
  splitTck,
} from './lists-view.utils';

const status = (patch: Partial<ListRowStatus> = {}): ListRowStatus => ({
  reserved: false,
  reservedByOther: false,
  reservedUntil: null,
  deferral: false,
  deferralUntil: null,
  deferralUntilMobilizationEnd: false,
  mobilized: false,
  mobilizationOrder: false,
  pendingNotices: 0,
  lastNoticeDate: null,
  warnings: 0,
  position: '',
  positionSince: null,
  ...patch,
});

const row = (
  name: string,
  tax: string,
  vos: string,
  patch: Partial<ListRowStatus> = {},
): ListRow => {
  const cells = Array<string>(18).fill('');
  cells[3] = name;
  cells[6] = tax;
  cells[7] = vos;
  return {
    employeeId: name,
    tckId: null,
    group: 'G2',
    section: 'SOLDIERS',
    category: 'LIABLE',
    cells,
    status: status(patch),
  };
};

const rows = [
  row('Коваль Іван Петрович', '3287300019', '100915', { deferral: true }),
  row('Мар’яненко Олег Ігорович', '3287300027', '021101', { reserved: true, pendingNotices: 1 }),
  row('Ткаченко Петро Іванович', '', '', { warnings: 2 }),
];

describe('lists view', () => {
  it('пошук за ПІБ, РНОКПП і ВОС без урахування регістру й апострофа', () => {
    expect(matchesSearch(rows[0], 'коваль')).toBe(true);
    expect(matchesSearch(rows[1], 'марян')).toBe(true);
    expect(matchesSearch(rows[1], '32873000')).toBe(true);
    expect(matchesSearch(rows[0], '100 915')).toBe(true);
    expect(matchesSearch(rows[2], 'коваль')).toBe(false);
  });

  it('швидкі фільтри поєднуються з пошуком', () => {
    expect(filterRows(rows, '', new Set(['DEFERRAL'])).map((r) => r.employeeId)).toEqual([
      'Коваль Іван Петрович',
    ]);
    expect(filterRows(rows, '', new Set(['RESERVED', 'PENDING']))).toHaveLength(1);
    expect(filterRows(rows, 'ткаченко', new Set(['WARNINGS']))).toHaveLength(1);
    expect(filterRows(rows, 'коваль', new Set(['WARNINGS']))).toHaveLength(0);
    expect(filterRows(rows, '', new Set())).toHaveLength(3);
  });

  it('РНОКПП у рядку частково приховано, паспорт — як є', () => {
    expect(maskTaxNumber('3287300019')).toBe('3287…019');
    expect(maskTaxNumber('КЛ 023008')).toBe('КЛ 023008');
  });

  it('назва ТЦК: коротко + місто', () => {
    expect(splitTck('Сихівський РТЦК та СП (м. Львів)')).toEqual({
      name: 'Сихівський РТЦК',
      place: 'м. Львів',
    });
    expect(splitTck('Стрийський РТЦК та СП')).toEqual({ name: 'Стрийський РТЦК', place: '' });
    expect(splitTck('')).toEqual({ name: '', place: '' });
  });
});

describe('витяги для ТЦК', () => {
  it('усі чотири списки — без фільтра груп; окремі — їхні групи разом з резервістами', () => {
    expect(groupsOfSections(new Set(['OFFICERS', 'SOLDIERS', 'WOMEN', 'CONSCRIPTS']))).toEqual([]);
    expect(groupsOfSections(new Set(['OFFICERS', 'CONSCRIPTS']))).toEqual([
      'G1',
      'G1R',
      'G4',
      'G4R',
    ]);
  });

  it('кількість у витязі — лише обрані списки', () => {
    const item = {
      tckId: 't1',
      tckName: 'Сихівський РТЦК та СП',
      sections: { OFFICERS: 2, SOLDIERS: 5, WOMEN: 1, CONSCRIPTS: 3 },
      total: 11,
      lastLetter: null,
    };
    expect(extractCount(item, new Set(['OFFICERS', 'WOMEN']))).toBe(3);
  });
});
