import type { ChangeType } from '../interfaces/dictionary.interface';
import type { EmployeeDetails, EmployeePosition } from '../interfaces/employee.interface';
import type {
  EmployeeNotice,
  ExternalNoticeType,
  StaffNoticeRow,
} from '../interfaces/letter.interface';
import { isoToDisplay } from './date.utils';

/**
 * What a notice about a queued change reports: hiring, a transfer (new position), dismissal — they go into
 * column 18 of the lists — or another change of the registration data.
 */
export function externalNoticeType(type: ChangeType): ExternalNoticeType {
  return type === 'HIRE' || type === 'POSITION' || type === 'DISMISSAL' ? type : 'DATA';
}

const order = (doc: string, number: string, date: string | null) =>
  number || date
    ? `${doc || 'наказ'}${number ? ` № ${number}` : ''}${date ? ` від ${isoToDisplay(date)}` : ''}`
    : '';
const detail = (...parts: string[]) => parts.filter(Boolean).join(' · ');

/**
 * The hiring, every transfer (the history of positions after the first one) and the dismissal of an employee,
 * each with the notices sent to the TCK about it and the change still waiting in the queue.
 */
export function staffNoticeRows(e: EmployeeDetails, notices: EmployeeNotice[]): StaffNoticeRow[] {
  const pending = (e.changes ?? []).filter((c) => !c.letter && !c.skipped);
  const ofType = (t: StaffNoticeRow['type']) => notices.filter((n) => n.changeType === t);
  const queued = (t: StaffNoticeRow['type'], date?: string | null) =>
    pending.find((c) => c.type === t && (!date || c.effectiveDate === date)) ??
    pending.find((c) => c.type === t);
  const rows: StaffNoticeRow[] = [];

  if (e.hireDate) {
    const q = queued('HIRE');
    rows.push({
      key: 'HIRE',
      type: 'HIRE',
      title: 'Прийняття на роботу',
      date: e.hireDate,
      detail: detail(
        order(e.hireOrderDocName, e.hireOrderNumber, e.hireOrderDate),
        firstPosition(e),
      ),
      notices: ofType('HIRE'),
      pendingId: q?.id ?? null,
      overdue: !!q?.overdue,
    });
  }

  const transfers = [...(e.positions ?? [])]
    .sort((a, b) => (a.since ?? '').localeCompare(b.since ?? ''))
    .slice(1);
  const positionNotices = ofType('POSITION');
  const used = new Set<string>();
  transfers.forEach((p, i) => {
    const matched = positionNotices.filter(
      (n) => !used.has(n.id) && (n.effectiveDate === p.since || transfers.length === 1),
    );
    matched.forEach((n) => used.add(n.id));
    const q = queued('POSITION', p.since);
    rows.push({
      key: `POSITION-${i}`,
      type: 'POSITION',
      title: 'Переведення',
      date: p.since,
      detail: detail(order(p.orderDocName, p.orderNumber, p.orderDate), p.position),
      notices: matched,
      pendingId: q?.id ?? null,
      overdue: !!q?.overdue,
    });
  });
  // a transfer known only from a notice or the queue (no history of positions in the card)
  const leftover = positionNotices.filter((n) => !used.has(n.id));
  const queuedTransfer = !transfers.length ? queued('POSITION') : undefined;
  if (leftover.length || queuedTransfer) {
    rows.push({
      key: 'POSITION-x',
      type: 'POSITION',
      title: 'Переведення',
      date: queuedTransfer?.effectiveDate ?? leftover[0]?.effectiveDate ?? e.positionSince,
      detail: detail(queuedTransfer?.newValue ?? e.position),
      notices: leftover,
      pendingId: queuedTransfer?.id ?? null,
      overdue: !!queuedTransfer?.overdue,
    });
  }

  if (e.dismissalDate) {
    const q = queued('DISMISSAL');
    rows.push({
      key: 'DISMISSAL',
      type: 'DISMISSAL',
      title: 'Звільнення',
      date: e.dismissalDate,
      detail: order(e.dismissalOrderDocName, e.dismissalOrderNumber, e.dismissalOrderDate),
      notices: ofType('DISMISSAL'),
      pendingId: q?.id ?? null,
      overdue: !!q?.overdue,
    });
  }
  return rows;
}

function firstPosition(e: EmployeeDetails): string {
  const first: EmployeePosition | undefined = [...(e.positions ?? [])].sort((a, b) =>
    (a.since ?? '').localeCompare(b.since ?? ''),
  )[0];
  return first?.position ?? e.position;
}
