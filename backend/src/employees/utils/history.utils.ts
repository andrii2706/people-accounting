/**
 * Human-readable history of an employee card: field names instead of technical keys,
 * dates as ДД.ММ.РРРР, ranks / TCKs by name, «так / ні» for checkboxes.
 */
import { formatUa, isIsoDate } from '../../common/utils/dates.utils.js';
import { maritalStatusLabel } from '../../military/dictionaries.js';
import { rankTitle } from '../../military/ranks.js';
import type { AuditLog } from '../entities/audit-log.entity.js';
import type { HistoryEntry } from '../../shared/interfaces/employee.interface.js';
import { ACTION_LABELS } from '../employees.constants.js';
import { FIELD_LABELS } from '../employees.constants.js';

export function historyEntries(rows: AuditLog[], tckNames: Map<string, string>, gender: 'M' | 'F'): HistoryEntry[] {
  const format = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'так' : 'ні';
    if (field === 'gender') return v === 'F' ? 'жіноча' : 'чоловіча';
    if (field === 'passportType') return v === 'BOOK' ? 'книжечка' : 'ID-картка';
    if (field === 'rankCode') return rankTitle(Number(v)) || String(v);
    if (field === 'tckId') return tckNames.get(String(v)) ?? 'інший ТЦК';
    if (field === 'reservedBy') return v === 'OTHER' ? 'інша юридична особа' : 'підприємство';
    if (field === 'maritalStatus') return maritalStatusLabel(v as never, gender) || String(v);
    if (typeof v === 'string' && isIsoDate(v)) return formatUa(v);
    return String(v);
  };
  return rows
    .filter((r) => r.action !== 'VIEW')
    .map((r) => ({
      id: r.id,
      action: r.action,
      actionLabel: ACTION_LABELS[r.action] ?? r.action,
      userName: r.userName,
      createdAt: r.createdAt,
      changes: Object.entries(r.diff ?? {}).map(([field, [from, to]]) => ({
        field,
        label: FIELD_LABELS[field] ?? field,
        from: format(field, from),
        to: format(field, to),
      })),
    }));
}
