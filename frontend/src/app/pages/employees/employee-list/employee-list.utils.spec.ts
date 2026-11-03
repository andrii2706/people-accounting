import type { EmployeeListItem } from '../../../shared/interfaces/employee.interface';
import { initials, matchesView, statusBadges, warningCount } from './employee-list.utils';

const emp = (patch: Partial<EmployeeListItem> = {}) =>
  ({
    id: 'e1',
    lastName: 'Приклад',
    firstName: 'Петро',
    dutyCategory: 'LIABLE',
    dismissalDate: null,
    mobilized: false,
    reserved: false,
    reservationUntil: null,
    deferral: false,
    deferralUntil: null,
    pendingChanges: 0,
    warnings: [],
    ...patch,
  }) as unknown as EmployeeListItem;

describe('список працівників', () => {
  it('добірки: увага, відстрочка, заброньовані', () => {
    const info = emp({ warnings: [{ code: 'NO_REGISTRY', level: 'info', message: '' }] });
    expect(matchesView(info, 'attention')).toBe(false);
    expect(matchesView(emp({ pendingChanges: 1 }), 'attention')).toBe(true);
    expect(matchesView(emp({ deferral: true }), 'deferral')).toBe(true);
    expect(matchesView(emp({ reserved: true }), 'reserved')).toBe(true);
    expect(matchesView(emp(), 'reserved')).toBe(false);
    expect(
      warningCount(
        emp({ pendingChanges: 2, warnings: [{ code: 'NO_TCK', level: 'warning', message: '' }] }),
      ),
    ).toBe(3);
  });

  it('мітки статусу з датами', () => {
    expect(statusBadges(emp({ reserved: true, reservationUntil: '2026-11-15' }))).toEqual([
      { label: 'Заброньований до 15.11', tone: 'ok' },
    ]);
    expect(statusBadges(emp({ deferral: true, deferralUntil: '2026-12-01' }))[0].label).toBe(
      'Відстрочка до 01.12',
    );
    expect(statusBadges(emp({ dutyCategory: null }))[0].label).toBe('Не на обліку');
  });

  it('ініціали', () => {
    expect(initials(emp())).toBe('ПП');
  });
});
