import { LABEL_SETTINGS_LABELS, LEGAL_ENTITY_LABELS } from '../../common/constants/field-labels.constants.js';
import {
  LABEL_JOURNAL_PREFIX,
  LABEL_SETTING_FIELDS,
  LABEL_VALUE_TEXT,
} from '../../documents/label-settings.constants.js';
import type { LabelSettings } from '../../shared/interfaces/label-settings.interface.js';
import type { AuditLog } from '../../employees/entities/audit-log.entity.js';
import type { HistoryEntry } from '../../shared/interfaces/employee.interface.js';
import { ENTITY_ACTION_LABELS, ENTITY_HISTORY_LABELS } from '../legal-entities.constants.js';
import { formatUa } from '../../common/utils/dates.utils.js';

/** A value as text: objects as JSON (never «[object Object]»). */
function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean);
}

/** What changed between two states of a record: { field: [before, after] } for the given fields only. */
export function changedFields<T extends object>(
  before: T,
  after: T,
  fields: readonly (keyof T & string)[],
): Record<string, [unknown, unknown]> {
  const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
  const same = (a: unknown, b: unknown) => text(norm(a)) === text(norm(b));
  return Object.fromEntries(
    fields.filter((f) => !same(before[f], after[f])).map((f) => [f, [norm(before[f]), norm(after[f])]]),
  );
}

/** Changed label settings for the journal: { 'label:font': ['Arial', 'Calibri'] }. */
export function labelSettingsDiff(before: LabelSettings, after: LabelSettings): Record<string, [unknown, unknown]> {
  return Object.fromEntries(
    Object.entries(changedFields(before, after, LABEL_SETTING_FIELDS)).map(([k, v]) => [
      `${LABEL_JOURNAL_PREFIX}${k}`,
      v,
    ]),
  );
}

/** A field of the journal: the label settings are «Наклейки: Шрифт». */
function historyLabel(field: string): string {
  if (field.startsWith(LABEL_JOURNAL_PREFIX)) {
    const key = field.slice(LABEL_JOURNAL_PREFIX.length);
    return `Наклейки: ${LABEL_SETTINGS_LABELS[key] ?? key}`;
  }
  return ENTITY_HISTORY_LABELS[field] ?? LEGAL_ENTITY_LABELS[field] ?? field;
}

/** The journal of a legal entity as the page shows it (newest first, as loaded). */
export function entityHistory(rows: AuditLog[]): HistoryEntry[] {
  const format = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (field === 'reservationQuotaPercent') return `${text(v).replace('.', ',')}%`;
    if (field === 'reservationQuotaDocDate' || field === 'reservationQuotaValidUntil') return formatUa(text(v), '—');
    if (field.startsWith(LABEL_JOURNAL_PREFIX)) {
      if (Array.isArray(v)) return v.map((x) => LABEL_VALUE_TEXT[text(x)] ?? text(x)).join(' → ');
      return LABEL_VALUE_TEXT[text(v)] ?? text(v).replace('.', ',');
    }
    return text(v);
  };
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actionLabel: ENTITY_ACTION_LABELS[r.action] ?? r.action,
    userName: r.userName,
    createdAt: r.createdAt,
    changes: Object.entries(r.diff ?? {}).map(([field, [from, to]]) => ({
      field,
      label: historyLabel(field),
      from: format(field, from),
      to: format(field, to),
    })),
  }));
}
