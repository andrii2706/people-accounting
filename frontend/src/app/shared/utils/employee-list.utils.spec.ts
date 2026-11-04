import type { EmployeeListItem } from '../interfaces/employee.interface';
import {
  initials,
  isDismissed,
  matchesView,
  statusBadges,
  warningCount,
} from './employee-list.utils';

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
    const info = emp({ warnings: [{ code: 'NO_REGISTRY', level: 'info' }] });
    expect(matchesView(info, 'attention')).toBe(false);
    expect(matchesView(emp({ pendingChanges: 1 }), 'attention')).toBe(true);
    expect(matchesView(emp({ deferral: true }), 'deferral')).toBe(true);
    expect(matchesView(emp({ reserved: true }), 'reserved')).toBe(true);
    expect(matchesView(emp(), 'reserved')).toBe(false);
    expect(
      warningCount(emp({ pendingChanges: 2, warnings: [{ code: 'NO_TCK', level: 'warning' }] })),
    ).toBe(3);
  });

  it('вкладки: усі — усі, решта — лише свої', () => {
    const today = '2026-11-04';
    const gone = emp({ dismissalDate: '2026-11-01', reserved: true, deferral: true });
    const leaving = emp({ dismissalDate: '2026-11-20', reserved: true });
    const warned = emp({ warnings: [{ code: 'NO_TCK', level: 'warning' }] });
    expect(isDismissed(gone, today)).toBe(true);
    expect(isDismissed(leaving, today)).toBe(false);
    // «Усі» — everyone, the dismissed too
    expect([gone, leaving, warned].every((e) => matchesView(e, 'all', today))).toBe(true);
    // «Звільнені» — only the dismissed (a future dismissal date is still working)
    expect(matchesView(gone, 'dismissed', today)).toBe(true);
    expect(matchesView(leaving, 'dismissed', today)).toBe(false);
    expect(matchesView(warned, 'dismissed', today)).toBe(false);
    // a dismissed employee is neither reserved nor on a deferral any more
    expect(matchesView(gone, 'reserved', today)).toBe(false);
    expect(matchesView(gone, 'deferral', today)).toBe(false);
    expect(matchesView(leaving, 'reserved', today)).toBe(true);
    // attention: card problems of the working; for the dismissed — only an unsent TCK notice
    expect(matchesView(warned, 'attention', today)).toBe(true);
    expect(
      matchesView(
        emp({ dismissalDate: '2026-11-01', warnings: [{ code: 'NO_TCK', level: 'warning' }] }),
        'attention',
        today,
      ),
    ).toBe(false);
    expect(
      matchesView(emp({ dismissalDate: '2026-11-01', pendingChanges: 1 }), 'attention', today),
    ).toBe(true);
    expect(matchesView(emp(), 'attention', today)).toBe(false);
  });

  it('мітки статусу з датами', () => {
    expect(statusBadges(emp({ reserved: true, reservationUntil: '2026-11-15' }))).toEqual([
      { label: 'Заброньований до 15.11', tone: 'ok' },
    ]);
    expect(statusBadges(emp({ deferral: true, deferralUntil: '2026-12-01' }))[0].label).toBe(
      'Відстрочка до 01.12',
    );
    expect(statusBadges(emp({ dutyCategory: null }))[0].label).toBe('Не на обліку');
    expect(statusBadges(emp({ dismissalDate: '2020-01-31', reserved: true }))).toEqual([
      { label: 'Звільнений 31.01', tone: 'muted' },
    ]);
  });

  it('ініціали', () => {
    expect(initials(emp())).toBe('ПП');
  });
});
