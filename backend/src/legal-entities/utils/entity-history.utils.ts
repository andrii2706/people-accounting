import { LEGAL_ENTITY_LABELS } from '../../common/constants/field-labels.constants.js';
import type { AuditLog } from '../../employees/entities/audit-log.entity.js';
import type { HistoryEntry } from '../../shared/interfaces/employee.interface.js';
import { ENTITY_ACTION_LABELS, ENTITY_HISTORY_LABELS } from '../legal-entities.constants.js';

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

/** The journal of a legal entity as the page shows it (newest first, as loaded). */
export function entityHistory(rows: AuditLog[]): HistoryEntry[] {
  const format = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (field === 'reservationQuotaPercent') return `${text(v).replace('.', ',')}%`;
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
      label: ENTITY_HISTORY_LABELS[field] ?? LEGAL_ENTITY_LABELS[field] ?? field,
      from: format(field, from),
      to: format(field, to),
    })),
  }));
}
