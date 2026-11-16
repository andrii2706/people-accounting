import { LIST_COLUMN_OPTIONS } from '../constants/list-settings.constants';
import type { SortableItem } from '../interfaces/label-settings.interface';
import type {
  ListColumnKey,
  ListSectionSettings,
  ListSectionSettingsBody,
} from '../interfaces/list-settings.interface';

const OPTION = new Map(LIST_COLUMN_OPTIONS.map((o) => [o.value, o]));

/** What is saved: everything but the template (it is uploaded separately). */
export function sectionBody(s: ListSectionSettings): ListSectionSettingsBody {
  return {
    columns: [...s.columns],
    sort: s.sort,
    groupBy: s.groupBy,
    title: s.title,
    subtitle: s.subtitle,
    showOutgoing: s.showOutgoing,
    signers: s.signers.map((x) => ({ ...x })),
  };
}

/** A column on or off; a new one goes to the end, «№» stays first. */
export function toggleColumn(
  columns: ListColumnKey[],
  key: ListColumnKey,
  on: boolean,
): ListColumnKey[] {
  if (key === 'number') return columns;
  const rest = columns.filter((c) => c !== key);
  return on ? [...rest, key] : rest;
}

/** The chosen columns after «№» — for the sortable list. */
export function columnItems(columns: ListColumnKey[]): SortableItem[] {
  return columns
    .filter((c) => c !== 'number')
    .map((c) => ({ value: c, label: `${OPTION.get(c)?.label ?? c} · гр. ${OPTION.get(c)?.form}` }));
}

/** The new order from the sortable list, «№» first. */
export const withNumberFirst = (order: string[]): ListColumnKey[] => [
  'number',
  ...(order as ListColumnKey[]),
];

/** 12320 → «12 КБ». */
export function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} КБ`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}
