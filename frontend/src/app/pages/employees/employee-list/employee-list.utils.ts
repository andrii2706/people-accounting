import type { EmployeeListItem } from '../../../shared/interfaces/employee.interface';

/** Tabs of the employee list. */
export type EmployeeView = 'all' | 'attention' | 'deferral' | 'reserved' | 'dismissed';

export const EMPLOYEE_VIEWS: { value: EmployeeView; label: string }[] = [
  { value: 'all', label: 'Усі' },
  { value: 'attention', label: 'Потребують уваги' },
  { value: 'deferral', label: 'Відстрочка' },
  { value: 'reserved', label: 'Заброньовані' },
  { value: 'dismissed', label: 'Звільнені' },
];

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

export interface StatusBadge {
  label: string;
  tone: 'ok' | 'warning' | 'info' | 'muted';
}

const ua = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.');

/** Status of the employee for the table: reservation, deferral, mobilization, not on registration. */
export function statusBadges(e: EmployeeListItem): StatusBadge[] {
  const badges: StatusBadge[] = [];
  if (e.dismissalDate) badges.push({ label: `Звільнений ${ua(e.dismissalDate)}`, tone: 'muted' });
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
