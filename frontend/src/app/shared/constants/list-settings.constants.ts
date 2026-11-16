import type {
  ListColumnOption,
  ListGrouping,
  ListSort,
} from '../interfaces/list-settings.interface';
import type { SelectOption } from '../interfaces/ui.interface';
import type { ListSection } from '../interfaces/dictionary.interface';
import { LIST_COLUMNS, LIST_TABS } from './lists.constants';

const KEYS = [
  'number',
  'category',
  'rank',
  'fullName',
  'birthDate',
  'registryNumber',
  'taxNumber',
  'vos',
  'militaryDoc',
  'passport',
  'address',
  'tck',
  'deferral',
  'reservation',
  'served',
  'mobilizationOrder',
  'position',
  'notices',
] as const;

/** The 18 columns of the form, in its order. */
export const LIST_COLUMN_OPTIONS: ListColumnOption[] = KEYS.map((value, i) => ({
  value,
  label: LIST_COLUMNS[i],
  form: i + 1,
}));

export const LIST_SORT_OPTIONS: SelectOption<ListSort>[] = [
  { value: 'NAME', label: 'За прізвищем (абеткою)' },
  { value: 'RANK', label: 'За званням (від старшого)' },
  { value: 'BIRTH_DATE', label: 'За датою народження (від старшого)' },
];

export const LIST_GROUPING_OPTIONS: SelectOption<ListGrouping>[] = [
  { value: 'NONE', label: 'Без підзаголовків' },
  { value: 'CATEGORY', label: 'За категорією (військовозобов’язані / резервісти)' },
  { value: 'TCK', label: 'За ТЦК, де перебувають на обліку' },
  { value: 'DEPARTMENT', label: 'За підрозділом' },
];

export const MAX_LIST_SIGNERS = 3;
export const MAX_LIST_TITLE = 200;
export const MAX_LIST_SUBTITLE = 500;
/** An uploaded Word template — not more than 2 MB. */
export const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024;

/** The four lists as tabs of the settings page. */
export const LIST_SECTION_TABS = LIST_TABS.filter(
  (t): t is SelectOption<ListSection> => t.value !== 'ALL',
);
