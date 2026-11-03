import { todayIso } from './date.utils';
import type { EmployeeListItem, EmployeeView, StatusBadge } from '../interfaces/employee.interface';

/** Warnings and errors (not info) of the card plus changes not reported to the TCK. */
export function warningCount(e: EmployeeListItem): number {
  return e.warnings.filter((w) => w.level !== 'info').length + e.pendingChanges;
}

export function matchesView(e: EmployeeListItem, view: EmployeeView): boolean {
  switch (view) {
    case 'attention':
      return warningCount(e) > 0;
    case 'deferral':
      return e.deferral;
    case 'reserved':
      return e.reserved;
    default:
      return true;
  }
}

const ua = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.');

/** Status of the employee for the table: reservation, deferral, mobilization, not on registration. */
export function statusBadges(e: EmployeeListItem): StatusBadge[] {
  const badges: StatusBadge[] = [];
  if (e.dismissalDate)
    badges.push(
      e.dismissalDate > todayIso()
        ? { label: `Звільнення ${ua(e.dismissalDate)}`, tone: 'warning' }
        : { label: `Звільнений ${ua(e.dismissalDate)}`, tone: 'muted' },
    );
  if (e.mobilized) badges.push({ label: 'Мобілізований', tone: 'info' });
  if (e.reserved)
    badges.push({
      label: e.reservationUntil ? `Заброньований до ${ua(e.reservationUntil)}` : 'Заброньований',
      tone: 'ok',
    });
  if (e.deferral)
    badges.push({
      label: e.deferralUntil ? `Відстрочка до ${ua(e.deferralUntil)}` : 'Відстрочка',
      tone: 'warning',
    });
  if (!e.dutyCategory && !e.dismissalDate) badges.push({ label: 'Не на обліку', tone: 'muted' });
  return badges;
}

export function initials(e: Pick<EmployeeListItem, 'lastName' | 'firstName'>): string {
  return `${e.lastName.charAt(0)}${e.firstName.charAt(0)}`.toUpperCase();
}

export function hasDanger(e: EmployeeListItem): boolean {
  return e.warnings.some((w) => w.level === 'danger');
}
