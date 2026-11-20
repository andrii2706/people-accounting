import type { EmployeeDetails } from '../interfaces/employee.interface';
import type { EmployeeNotice } from '../interfaces/letter.interface';
import { externalNoticeType, staffNoticeRows } from './letter.utils';

describe('externalNoticeType', () => {
  it('hiring, transfer and dismissal keep their type (column 18 of the lists)', () => {
    expect(externalNoticeType('HIRE')).toBe('HIRE');
    expect(externalNoticeType('POSITION')).toBe('POSITION');
    expect(externalNoticeType('DISMISSAL')).toBe('DISMISSAL');
  });

  it('other changes are «зміна облікових даних»', () => {
    expect(externalNoticeType('LAST_NAME')).toBe('DATA');
    expect(externalNoticeType('ACTUAL_ADDRESS')).toBe('DATA');
  });
});

const notice = (
  id: string,
  changeType: string,
  effectiveDate: string,
  number: string,
): EmployeeNotice =>
  ({
    id,
    changeType,
    effectiveDate,
    number,
    letter: { id: `l${id}`, number, date: effectiveDate, status: 'SENT', external: true },
  }) as unknown as EmployeeNotice;

const employee = (over: Partial<EmployeeDetails> = {}) =>
  ({
    hireDate: '2025-03-01',
    hireOrderDocName: 'наказ',
    hireOrderNumber: '12-к',
    hireOrderDate: '2025-02-27',
    position: 'старший інженер',
    positionSince: '2026-06-01',
    positions: [
      {
        position: 'інженер',
        department: '',
        since: '2025-03-01',
        orderDocName: '',
        orderNumber: '',
        orderDate: null,
      },
      {
        position: 'старший інженер',
        department: '',
        since: '2026-06-01',
        orderDocName: 'наказ',
        orderNumber: '40-к',
        orderDate: '2026-05-30',
      },
    ],
    dismissalDate: null,
    dismissalOrderDocName: '',
    dismissalOrderNumber: '',
    dismissalOrderDate: null,
    changes: [
      {
        id: 'c1',
        type: 'POSITION',
        effectiveDate: '2026-06-01',
        letter: null,
        skipped: false,
        overdue: true,
        newValue: 'старший інженер',
      },
    ],
    ...over,
  }) as unknown as EmployeeDetails;

describe('staffNoticeRows', () => {
  it('hiring with its notice, a transfer still in the queue', () => {
    const rows = staffNoticeRows(employee(), [notice('n1', 'HIRE', '2025-03-01', '15')]);
    expect(rows.map((r) => r.type)).toEqual(['HIRE', 'POSITION']);
    expect(rows[0].notices.map((n) => n.number)).toEqual(['15']);
    expect(rows[0].detail).toBe('наказ № 12-к від 27.02.2025 · інженер');
    expect(rows[1]).toMatchObject({
      date: '2026-06-01',
      pendingId: 'c1',
      overdue: true,
      notices: [],
    });
    expect(rows[1].detail).toBe('наказ № 40-к від 30.05.2026 · старший інженер');
  });

  it('dismissal appears with the date of dismissal', () => {
    const rows = staffNoticeRows(employee({ dismissalDate: '2026-11-19', changes: [] }), []);
    expect(rows.at(-1)).toMatchObject({ type: 'DISMISSAL', date: '2026-11-19', pendingId: null });
  });

  it('a transfer known only from a notice still shows', () => {
    const rows = staffNoticeRows(employee({ positions: [], changes: [] }), [
      notice('n2', 'POSITION', '2026-01-10', '7'),
    ]);
    expect(rows.find((r) => r.type === 'POSITION')?.notices.map((n) => n.number)).toEqual(['7']);
  });
});
