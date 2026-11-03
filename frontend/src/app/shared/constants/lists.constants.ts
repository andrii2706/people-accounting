import type { ListSection } from '../interfaces/dictionary.interface';
import type { ListDetailGroup, ListQuickFilter } from '../interfaces/report.interface';
import type { SelectOption } from '../interfaces/ui.interface';

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

/** Quick filters above the lists table. */
export const QUICK_FILTERS: SelectOption<ListQuickFilter>[] = [
  { value: 'RESERVED', label: 'Заброньовані' },
  { value: 'DEFERRAL', label: 'Відстрочка' },
  { value: 'MOBILIZATION_ORDER', label: 'Моброзпорядження' },
  { value: 'PENDING', label: 'Не повідомлено ТЦК' },
  { value: 'WARNINGS', label: 'Є попередження' },
];

/** Four lists: officers; rank-and-file, sergeants, petty officers; women; conscripts. */
export const LIST_SECTION_ORDER: ListSection[] = ['OFFICERS', 'SOLDIERS', 'WOMEN', 'CONSCRIPTS'];

/** Rows of one list drawn at once (a list can hold hundreds of people, 18 cells each). */
export const LIST_ROWS_PAGE = 100;

/** Short tab names of the lists page; the full official title stays above the table. */
export const LIST_TABS: SelectOption<ListSection | 'ALL'>[] = [
  { value: 'ALL', label: 'Усі' },
  { value: 'OFFICERS', label: 'Офіцери' },
  { value: 'SOLDIERS', label: 'Рядові, сержанти, старшини' },
  { value: 'WOMEN', label: 'Жінки' },
  { value: 'CONSCRIPTS', label: 'Призовники' },
];
