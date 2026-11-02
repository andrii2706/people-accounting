import type {
  ListDetailGroup,
  ListQuickFilter,
  ListRow,
} from '../../../shared/interfaces/report.interface';

/** Short column titles of the full table; the .docx uses the full titles of the form. */
export const LIST_COLUMNS = [
  '№',
  'Категорія',
  'Звання',
  'ПІБ',
  'Дата народж.',
  'Номер в ЄДР',
  'РНОКПП',
  'ВОС',
  'Військово-обліковий документ',
  'Паспорт',
  'Адреса',
  'ТЦК та СП',
  'Відстрочка',
  'Спецоблік (бронювання)',
  'Військова служба',
  'Моброзпорядження',
  'Посада, наказ',
  'Повідомлення ТЦК, відмітки',
];

/** Column indexes (0-based) of the cells used by the compact table. */
export const COL = {
  number: 0,
  category: 1,
  rank: 2,
  name: 3,
  birthDate: 4,
  taxNumber: 6,
  vos: 7,
  tck: 11,
} as const;

/** Blocks of the expanded row; numbers are the column numbers of the form. */
export const DETAIL_GROUPS: ListDetailGroup[] = [
  { title: 'Документи', columns: [6, 7, 9, 10] },
  { title: 'Проживання', columns: [11, 12] },
  { title: 'Облік', columns: [8, 13, 14, 15, 16] },
  { title: 'Робота й відмітки', columns: [17, 18] },
];

export const QUICK_FILTERS: { value: ListQuickFilter; label: string }[] = [
  { value: 'RESERVED', label: 'Заброньовані' },
  { value: 'DEFERRAL', label: 'Відстрочка' },
  { value: 'MOBILIZATION_ORDER', label: 'Моброзпорядження' },
  { value: 'PENDING', label: 'Не повідомлено ТЦК' },
  { value: 'WARNINGS', label: 'Є попередження' },
];

export function matchesQuickFilter(row: ListRow, filter: ListQuickFilter): boolean {
  const s = row.status;
  switch (filter) {
    case 'RESERVED':
      return s.reserved;
    case 'DEFERRAL':
      return s.deferral;
    case 'MOBILIZATION_ORDER':
      return s.mobilizationOrder;
    case 'PENDING':
      return s.pendingNotices > 0;
    case 'WARNINGS':
      return s.warnings > 0;
  }
}

const compact = (text: string) => text.toLowerCase().replace(/[\s'’ʼ-]/g, '');

/** Search by name, taxpayer number or VOS; spaces, apostrophes and case are ignored. */
export function matchesSearch(row: ListRow, query: string): boolean {
  const q = compact(query);
  if (!q) return true;
  return [COL.name, COL.taxNumber, COL.vos].some((i) => compact(row.cells[i] ?? '').includes(q));
}

export function filterRows(
  rows: readonly ListRow[],
  query: string,
  filters: ReadonlySet<ListQuickFilter>,
): ListRow[] {
  return rows.filter(
    (r) => matchesSearch(r, query) && [...filters].every((f) => matchesQuickFilter(r, f)),
  );
}

/** «3569…553» — the full number is in the expanded row; passport numbers stay as they are. */
export function maskTaxNumber(value: string): string {
  return /^\d{10}$/.test(value) ? `${value.slice(0, 4)}…${value.slice(-3)}` : value;
}

/** «Сихівський РТЦК та СП (м. Львів)» → name «Сихівський РТЦК», place «м. Львів». */
export function splitTck(name: string): { name: string; place: string } {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(name.trim());
  const base = (m ? m[1] : name).replace(/\s+та\s+СП$/u, '').trim();
  return { name: base, place: m ? m[2] : '' };
}
