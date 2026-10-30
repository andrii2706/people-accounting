import { describe, expect, it } from 'vitest';
import { fullYears } from '../common/utils/dates.js';
import {
  dutyCategory,
  hasMobilizationOrder,
  isOnListsAt,
  isReservedAt,
  listGroup,
  type MilitaryRecord,
  operationalRow,
  recordWarnings,
} from './military-logic.js';

const base: MilitaryRecord = {
  militaryRegistered: true,
  gender: 'M',
  birthDate: '1990-05-10',
  rankCode: 2,
  navy: false,
  hireDate: '2024-01-15',
  dismissalDate: null,
  reserveTeamNumber: null,
  mobilizationOrderDate: null,
  reserved: false,
  reservationBasis: null,
  reservationUntil: null,
  specialAccountingCertificate: null,
  deferralUntil: null,
  mobilizedAt: null,
  demobilizedAt: null,
  registryNumber: '123',
  tckId: 'tck',
  militaryDocNumber: 'AA1',
  trainingProfile: null,
};

describe('military logic', () => {
  it('рахує повні роки як формула AZ6', () => {
    expect(fullYears('1990-05-10', '2026-05-09')).toBe(35);
    expect(fullYears('1990-05-10', '2026-05-10')).toBe(36);
  });

  it('розподіляє по групах списків', () => {
    expect(listGroup(base)).toBe('G2');
    expect(listGroup({ ...base, rankCode: 14 })).toBe('G1');
    expect(listGroup({ ...base, rankCode: 14, reserveTeamNumber: '0123' })).toBe('G1R');
    expect(listGroup({ ...base, rankCode: 0 })).toBe('G4');
    expect(listGroup({ ...base, gender: 'F', rankCode: null })).toBe('G3');
    expect(operationalRow('G3R')).toBe('1.3');
  });

  it('визначає категорію військового обов’язку', () => {
    expect(dutyCategory(base)).toBe('LIABLE');
    expect(dutyCategory({ ...base, rankCode: 0 })).toBe('CONSCRIPT');
    expect(dutyCategory({ ...base, reserveTeamNumber: '15' })).toBe('RESERVIST');
  });

  it('звільнені залишаються у списках до кінця року звільнення', () => {
    const fired = { ...base, dismissalDate: '2026-03-01' };
    expect(isOnListsAt(fired, '2026-10-01')).toBe(true);
    expect(isOnListsAt(fired, '2027-01-01')).toBe(false);
  });

  it('мобілізовані виключаються зі списків', () => {
    expect(isOnListsAt({ ...base, mobilizedAt: '2025-06-01' }, '2026-01-01')).toBe(false);
    expect(isOnListsAt({ ...base, mobilizedAt: '2025-06-01', demobilizedAt: '2025-12-01' }, '2026-01-01')).toBe(true);
  });

  it('бронювання має пріоритет над моброзпорядженням', () => {
    const r = { ...base, reserveTeamNumber: '7', reserved: true, reservationBasis: 'п. 1', reservationUntil: '2027-01-01' };
    expect(isReservedAt(r, '2026-10-01')).toBe(true);
    expect(hasMobilizationOrder(r, '2026-10-01')).toBe(false);
  });

  it('попереджає про граничний вік і строк бронювання', () => {
    const codes = recordWarnings(
      { ...base, birthDate: '1960-01-01', reserved: true, reservationBasis: 'x', reservationUntil: '2026-10-20' },
      '2026-10-10',
    ).map((w) => w.code);
    expect(codes).toContain('AGE_LIMIT');
    expect(codes).toContain('RESERVATION_EXPIRING');
  });

  it('treats an employee as reserved only when it is chosen explicitly', () => {
    const data = { reservationBasis: 'Перелік №1', reservationUntil: '2027-01-01' };
    expect(isReservedAt({ ...base, ...data }, '2026-10-27')).toBe(false);
    expect(isReservedAt({ ...base, ...data, reserved: true }, '2026-10-27')).toBe(true);
    expect(isReservedAt({ ...base, ...data, reserved: true }, '2027-01-02')).toBe(false);
    // reserved by another legal entity: the mark is enough; a filled-in term is still checked
    expect(isReservedAt({ ...base, reserved: true, reservedBy: 'OTHER' }, '2030-01-01')).toBe(true);
    expect(isReservedAt({ ...base, reserved: true, reservedBy: 'OTHER', reservationUntil: '2027-01-01' }, '2026-12-31')).toBe(true);
    expect(isReservedAt({ ...base, reserved: true, reservedBy: 'OTHER', reservationUntil: '2027-01-01' }, '2027-01-02')).toBe(false);
    expect(isReservedAt({ ...base, reserved: false, reservedBy: 'OTHER' }, '2030-01-01')).toBe(false);
    expect(recordWarnings({ ...base, ...data, reservationUntil: '2026-10-01' }, '2026-10-27').some((w) => w.code === 'RESERVATION_EXPIRED')).toBe(false);
  });
});
