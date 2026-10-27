import { describe, expect, it } from 'vitest';
import type { Employee } from '../employees/entities/employee.entity.js';
import { postalCodeOf } from '../documents/builders.js';
import { employeesCount } from '../letters/letters.service.js';
import { LIST_TITLES, LIST_WIDTHS, personalListCells } from './personal-list.js';
import { notificationDeadline } from './military-logic.js';

process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.DATABASE_URL ??= 'postgres://test@localhost/test';

/** Fictitious employee — only the fields the list needs. */
function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1', gender: 'M', lastName: 'Тестенко', firstName: 'Тест', middleName: 'Тестович',
    rnokpp: '1111111111', birthDate: '1990-01-01', registeredAddress: 'м. Львів, вул. Тестова, 1', actualAddress: '',
    passportType: 'ID_CARD', passportSeries: '', passportNumber: '000000001', passportIssuedBy: '4610', passportIssuedAt: '2020-01-01',
    position: 'інженер', positionOrder: '', positionSince: null, hireDate: '2020-01-10', hireOrderNumber: '1-к', hireOrderDate: '2020-01-10',
    dismissalDate: null, dismissalOrderNumber: '', dismissalOrderDate: null, militaryRegistered: true,
    registryNumber: '0000000001', rankCode: 3, navy: false, vos: '100', trainingProfile: '', accountingCategory: '1',
    militaryDocType: 'військовий квиток', militaryDocSeries: '', militaryDocNumber: '000001', militaryDocIssuedBy: '', militaryDocIssuedAt: null,
    militaryDocGeneratedAt: '', tck: { name: 'Тестовий РТЦК та СП' }, tckId: 't1', reservationBasis: '', specialAccountingCertificate: '',
    reservationUntil: null, deferralConscriptionBasis: '', deferralMobilizationBasis: '', deferralUntil: null, reserveTeamNumber: '',
    mobilizationOrderDate: null, mobilizedAt: null, demobilizedAt: null, familyMembers: [],
    ...overrides,
  } as unknown as Employee;
}

describe('Annex 5 personal lists', () => {
  it('fills 18 columns for a person liable for military service', () => {
    const cells = personalListCells(employee(), '2026-10-27', 'про призначення: вих. № 1 від 10.01.2020 р.');
    expect(cells).toHaveLength(18);
    expect(cells[1]).toBe('військовозобов’язаний');
    expect(cells[5]).toBe('0000000001');
    expect(cells[6]).toBe('1111111111');
    expect(cells[14]).toBe('ні');
    expect(cells[15]).toBe('ні');
    expect(cells[17]).toContain('вих. № 1');
  });

  it('leaves rank, specialty, service and mobilization columns empty for conscripts', () => {
    const cells = personalListCells(employee({ rankCode: 0, vos: '' }), '2026-10-27', '');
    expect(cells[1]).toBe('призовник');
    expect([cells[2], cells[7], cells[14], cells[15]]).toEqual(['', '', '', '']);
  });

  it('marks reservists, mobilized and dismissed employees as the form requires', () => {
    const reservist = personalListCells(employee({ reserveTeamNumber: '0127' }), '2026-10-27', '');
    expect(reservist[1]).toBe('резервіст');
    expect(reservist[15]).toContain('в/ч 0127');

    const mobilized = personalListCells(employee({ mobilizedAt: '2025-03-15' }), '2026-10-27', '');
    expect(mobilized[14]).toBe('так');
    expect(mobilized[17]).toContain('Військовослужбовець з “15” березня 2025 р.');

    const dismissed = personalListCells(employee({ dismissalDate: '2026-09-30' }), '2026-10-27', '');
    expect(dismissed[17]).toContain('Звільнено з роботи, завершено навчання (відраховано)');
  });

  it('uses the passport instead of RNOKPP for people who refused the taxpayer number', () => {
    const cells = personalListCells(employee({ rnokpp: '', passportType: 'BOOK', passportSeries: 'аа', passportNumber: '123456' }), '2026-10-27', '');
    expect(cells[6]).toBe('АА 123456');
  });

  it('has 18 columns with a width for each', () => {
    expect(LIST_TITLES).toHaveLength(18);
    expect(LIST_WIDTHS).toHaveLength(18);
  });

  it('adds the actual address when it differs (like the Excel file)', () => {
    const cells = personalListCells(employee({ registeredAddress: 'м. Львів, вул. А, 1', actualAddress: 'м. Львів, вул. Б, 2' }), '2026-10-27', '');
    expect(cells[10]).toBe('м. Львів, вул. А, 1/ Фактичне місце проживання - м. Львів, вул. Б, 2');
  });
});

describe('labels and wording helpers', () => {
  it('takes the postal code from the field or from the address', () => {
    expect(postalCodeOf('79007', 'м. Львів')).toBe('79007');
    expect(postalCodeOf('', '79005, м. Львів, вул. Франка, 25')).toBe('79005');
    expect(postalCodeOf('', 'м. Львів, буд. 123456')).toBe('');
  });

  it('declines "працівник" correctly', () => {
    expect(employeesCount(1)).toBe('1 працівник');
    expect(employeesCount(2)).toBe('2 працівники');
    expect(employeesCount(5)).toBe('5 працівників');
    expect(employeesCount(11)).toBe('11 працівників');
    expect(employeesCount(22)).toBe('22 працівники');
  });
});

describe('notificationDeadline (Resolution No. 812)', () => {
  it('hire/dismissal — 7 days from the order date', () => {
    expect(notificationDeadline('HIRE', '2026-07-01', { hireOrderDate: '2026-06-30', dismissalOrderDate: null })).toBe('2026-07-07');
    expect(notificationDeadline('DISMISSAL', '2026-09-30', null)).toBe('2026-10-07');
  });
  it('other data — by the 5th of the next month', () => {
    expect(notificationDeadline('REGISTERED_ADDRESS', '2026-10-14')).toBe('2026-11-05');
    expect(notificationDeadline('POSITION', '2026-12-20')).toBe('2027-01-05');
  });
});
