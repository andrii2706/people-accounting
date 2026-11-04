import { todayIso } from './date.utils';
import type { EmployeeListItem, EmployeeView, StatusBadge } from '../interfaces/employee.interface';

/** Warnings and errors (not info) of the card plus changes not reported to the TCK. */
export function warningCount(e: EmployeeListItem): number {
  return e.warnings.filter((w) => w.level !== 'info').length + e.pendingChanges;
}

/** Dismissed on or before today (a dismissal later than today still counts as working). */
export function isDismissed(
  e: Pick<EmployeeListItem, 'dismissalDate'>,
  today = todayIso(),
): boolean {
  return !!e.dismissalDate && e.dismissalDate <= today;
}

/**
 * Tabs of the employee list: «Усі» — everyone, dismissed included; «Звільнені» — only the dismissed;
 * «Відстрочка» / «Заброньовані» — only working employees with a deferral / reservation in force.
 * «Потребують уваги» — working employees with problems, and the dismissed whose TCK notice is not sent yet.
 */
export function matchesView(e: EmployeeListItem, view: EmployeeView, today = todayIso()): boolean {
  const dismissed = isDismissed(e, today);
  switch (view) {
    case 'attention':
      return dismissed ? e.pendingChanges > 0 : warningCount(e) > 0;
    case 'deferral':
      return !dismissed && e.deferral;
    case 'reserved':
      return !dismissed && e.reserved;
    case 'dismissed':
      return dismissed;
    default:
      return true;
  }
}

const ua = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.');

/** Status of the employee for the table: reservation, deferral, mobilization, not on registration. */
export function statusBadges(e: EmployeeListItem): StatusBadge[] {
  const badges: StatusBadge[] = [];
  // a dismissed employee has no reservation or deferral any more — only the dismissal date
  if (e.dismissalDate && isDismissed(e))
    return [{ label: `Звільнений ${ua(e.dismissalDate)}`, tone: 'muted' }];
  if (e.dismissalDate) badges.push({ label: `Звільнення ${ua(e.dismissalDate)}`, tone: 'warning' });
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
