import type { DutyCategory } from '../../../shared/interfaces/dictionary.interface.js';
import type {
  LayoutRow,
  ListColumnKey,
  ListGrouping,
  ListLayout,
  ListSectionSettings,
  ListSort,
  ListTemplateGroup,
  ListTemplateRow,
} from '../../../shared/interfaces/list-settings.interface.js';
import {
  GROUP_CATEGORY_TITLES,
  GROUP_WITHOUT_DEPARTMENT,
  GROUP_WITHOUT_TCK,
  LIST_COLUMN_KEYS,
} from '../lists.constants.js';

const COLUMN_INDEX = new Map(LIST_COLUMN_KEYS.map((k, i) => [k, i]));
const CATEGORY_ORDER: DutyCategory[] = ['LIABLE', 'RESERVIST', 'CONSCRIPT'];
const FULL_NAME = COLUMN_INDEX.get('fullName')!;
const TCK = COLUMN_INDEX.get('tck')!;

const byName = (a: LayoutRow, b: LayoutRow) => a.cells[FULL_NAME].localeCompare(b.cells[FULL_NAME], 'uk');

const COMPARE: Record<ListSort, (a: LayoutRow, b: LayoutRow) => number> = {
  NAME: byName,
  // the higher rank first (a bigger code — a higher rank)
  RANK: (a, b) => (b.meta.rankCode ?? -1) - (a.meta.rankCode ?? -1) || byName(a, b),
  // the older first; without a date — at the end
  BIRTH_DATE: (a, b) => (a.meta.birthDate ?? '9999').localeCompare(b.meta.birthDate ?? '9999') || byName(a, b),
};

function groupTitle(row: LayoutRow, by: ListGrouping): string {
  switch (by) {
    case 'CATEGORY':
      return row.category ? GROUP_CATEGORY_TITLES[row.category] : '';
    case 'TCK':
      return row.cells[TCK] || GROUP_WITHOUT_TCK;
    case 'DEPARTMENT':
      return row.meta.department.trim() || GROUP_WITHOUT_DEPARTMENT;
    default:
      return '';
  }
}

/** Order of the groups: categories as in the law; the rest alphabetically, «не вказано» last. */
function groupOrder(by: ListGrouping) {
  if (by === 'CATEGORY') {
    const titles = CATEGORY_ORDER.map((c) => GROUP_CATEGORY_TITLES[c] as string);
    return (a: string, b: string) => titles.indexOf(a) - titles.indexOf(b);
  }
  const last = by === 'TCK' ? GROUP_WITHOUT_TCK : GROUP_WITHOUT_DEPARTMENT;
  return (a: string, b: string) => (a === last ? 1 : b === last ? -1 : a.localeCompare(b, 'uk'));
}

/** Rows sorted and grouped; numbers go through the whole list (column 1). */
export function arrangeList(rows: LayoutRow[], s: Pick<ListSectionSettings, 'sort' | 'groupBy'>) {
  const sorted = [...rows].sort(COMPARE[s.sort]);
  const groups = new Map<string, LayoutRow[]>();
  for (const row of sorted) {
    const title = groupTitle(row, s.groupBy);
    groups.set(title, [...(groups.get(title) ?? []), row]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => groupOrder(s.groupBy)(a, b));
  let n = 0;
  return ordered.map(([title, items]) => ({
    title,
    rows: items.map((row) => {
      const cells = [...row.cells];
      cells[0] = String(++n);
      return cells;
    }),
  }));
}

/** The list for the built-in document: arranged, only the chosen columns. */
export function layoutList(rows: LayoutRow[], s: ListSectionSettings): ListLayout {
  const columns = visibleColumns(s.columns);
  const indexes = columns.map((c) => COLUMN_INDEX.get(c)!);
  const groups = arrangeList(rows, s).map((g) => ({
    title: g.title,
    rows: g.rows.map((r) => indexes.map((i) => r[i])),
  }));
  return { columns, groups, count: rows.length };
}

/** Known, unique, «number» first — whatever was saved. */
export function visibleColumns(columns: ListColumnKey[]): ListColumnKey[] {
  const unique = [...new Set(columns.filter((c) => COLUMN_INDEX.has(c)))];
  return ['number', ...unique.filter((c) => c !== 'number')];
}

/** 1-based column numbers of the form for the chosen columns (the numbering row of the table). */
export const formColumnNumbers = (columns: ListColumnKey[]) => columns.map((c) => COLUMN_INDEX.get(c)! + 1);

/** A row for a Word template: every column by its key, «n» — the number. */
export function templateRow(cells: string[]): ListTemplateRow {
  const row: ListTemplateRow = { n: cells[0] };
  LIST_COLUMN_KEYS.forEach((k, i) => (row[k] = cells[i] ?? ''));
  return row;
}

/** The groups for a Word template (one group without a title when there is no grouping). */
export function templateGroups(rows: LayoutRow[], s: ListSectionSettings): ListTemplateGroup[] {
  return arrangeList(rows, s).map((g) => ({ title: g.title, count: g.rows.length, rows: g.rows.map(templateRow) }));
}
