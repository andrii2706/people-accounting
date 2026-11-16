import { describe, expect, it } from 'vitest';
import type { LayoutRow } from '../../../shared/interfaces/list-settings.interface.js';
import { DEFAULT_LIST_SECTION } from '../lists.constants.js';
import { arrangeList, formColumnNumbers, layoutList, templateGroups, visibleColumns } from './list-layout.utils.js';

/** A fictitious row: 18 cells, the name in column 4, the TCK in column 12. */
function row(
  name: string,
  o: Partial<LayoutRow['meta']> & { tck?: string; category?: LayoutRow['category'] } = {},
): LayoutRow {
  const cells = Array.from({ length: 18 }, (_, i) => `c${i + 1}`);
  cells[3] = name;
  cells[11] = o.tck ?? '';
  return {
    cells,
    category: o.category ?? 'LIABLE',
    meta: { rankCode: o.rankCode ?? null, birthDate: o.birthDate ?? null, department: o.department ?? '' },
  };
}

describe('arrangeList', () => {
  const rows = [
    row('Яковенко', { rankCode: 10, birthDate: '1990-01-01', tck: 'Б ТЦК', category: 'RESERVIST' }),
    row('Андрієнко', { rankCode: 20, birthDate: '1980-01-01', tck: '', department: 'Цех' }),
    row('Бойко', { rankCode: 15, birthDate: null, tck: 'А ТЦК' }),
  ];

  it('за прізвищем, номери наскрізні', () => {
    const [g] = arrangeList(rows, { sort: 'NAME', groupBy: 'NONE' });
    expect(g.rows.map((r) => `${r[0]} ${r[3]}`)).toEqual(['1 Андрієнко', '2 Бойко', '3 Яковенко']);
  });

  it('за званням (старше вище) і за датою народження (без дати — в кінці)', () => {
    expect(arrangeList(rows, { sort: 'RANK', groupBy: 'NONE' })[0].rows.map((r) => r[3])).toEqual([
      'Андрієнко',
      'Бойко',
      'Яковенко',
    ]);
    expect(arrangeList(rows, { sort: 'BIRTH_DATE', groupBy: 'NONE' })[0].rows.map((r) => r[3])).toEqual([
      'Андрієнко',
      'Яковенко',
      'Бойко',
    ]);
  });

  it('групи за ТЦК: за абеткою, «не вказано» в кінці; нумерація через групи', () => {
    const groups = arrangeList(rows, { sort: 'NAME', groupBy: 'TCK' });
    expect(groups.map((g) => g.title)).toEqual(['А ТЦК', 'Б ТЦК', 'ТЦК не вказано']);
    expect(groups.map((g) => g.rows[0][0])).toEqual(['1', '2', '3']);
  });

  it('групи за категорією — у порядку закону; за підрозділом — «Без підрозділу» в кінці', () => {
    expect(arrangeList(rows, { sort: 'NAME', groupBy: 'CATEGORY' }).map((g) => g.title)).toEqual([
      'Військовозобов’язані',
      'Резервісти',
    ]);
    expect(arrangeList(rows, { sort: 'NAME', groupBy: 'DEPARTMENT' }).map((g) => g.title)).toEqual([
      'Цех',
      'Без підрозділу',
    ]);
  });
});

describe('layoutList', () => {
  it('лише обрані колонки в обраному порядку, «№» першим', () => {
    const layout = layoutList([row('Бойко')], { ...DEFAULT_LIST_SECTION, columns: ['fullName', 'number', 'tck'] });
    expect(layout.columns).toEqual(['number', 'fullName', 'tck']);
    expect(layout.groups[0].rows[0]).toEqual(['1', 'Бойко', '']);
    expect(formColumnNumbers(layout.columns)).toEqual([1, 4, 12]);
  });

  it('невідомі й повторені колонки відкидаються', () => {
    expect(visibleColumns(['rank', 'rank', 'bogus' as never])).toEqual(['number', 'rank']);
  });
});

describe('templateGroups', () => {
  it('кожна колонка за ключем і номер {n}', () => {
    const [g] = templateGroups([row('Бойко', { tck: 'А ТЦК' })], DEFAULT_LIST_SECTION);
    expect(g).toMatchObject({ title: '', count: 1 });
    expect(g.rows[0]).toMatchObject({ n: '1', number: '1', fullName: 'Бойко', tck: 'А ТЦК', notices: 'c18' });
  });
});
