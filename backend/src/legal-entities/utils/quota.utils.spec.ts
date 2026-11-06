import { describe, expect, it } from 'vitest';
import type { Employee } from '../../employees/entities/employee.entity.js';
import { entityQuota, quotaPlaces, quotaStanding } from './quota.utils.js';

const DATE = '2026-11-05';
const ENTITY = { id: 'le1', fullName: 'ТОВ «Приклад»', shortName: '', reservationQuotaPercent: 50 };

/** A working military-liable man of the entity (fictional). */
function worker(overrides: Partial<Employee> = {}): Employee {
  return {
    legalEntityId: 'le1',
    gender: 'M',
    birthDate: '1990-01-01',
    hireDate: '2020-01-10',
    dismissalDate: null,
    militaryRegistered: true,
    rankCode: 3,
    reserveTeamNumber: '',
    reserved: false,
    reservedBy: 'COMPANY',
    reservationUntil: null,
    ...overrides,
  } as unknown as Employee;
}

const reservedOwn = { reserved: true, reservedBy: 'COMPANY' as const, reservationUntil: '2027-01-01' };

describe('квота бронювання у відсотках', () => {
  it('місць — відсоток від бази, з округленням униз', () => {
    expect(quotaPlaces(50, 7)).toBe(3);
    expect(quotaPlaces(50, 20)).toBe(10);
    expect(quotaPlaces(33.33, 3)).toBe(0);
    expect(quotaPlaces(100, 3)).toBe(3);
    expect(quotaPlaces(null, 10)).toBeNull();
  });

  it('20 в/з чоловіків, 50%, 4 заброньовані юрособою — місць 10, вільно 6', () => {
    const staff = [
      ...Array.from({ length: 4 }, () => worker(reservedOwn)),
      ...Array.from({ length: 16 }, () => worker()),
    ].map((e) => quotaStanding(e, DATE));
    expect(entityQuota(ENTITY, staff)).toMatchObject({ base: 20, quota: 10, reservedCompany: 4, available: 6 });
  });

  it('у базі лише працюючі військовозобов’язані чоловіки', () => {
    const staff = [
      worker(),
      worker({ gender: 'F' }), // жінка
      worker({ rankCode: 0 }), // призовник
      worker({ reserveTeamNumber: '12' }), // резервіст
      worker({ dismissalDate: '2026-10-01' }), // звільнений
      worker({ militaryRegistered: false }), // не на обліку
      worker({ reserved: true, reservedBy: 'OTHER', reservationUntil: '2027-01-01' }), // бронює інше підприємство
      worker({ legalEntityId: 'le2' }), // інша юрособа
    ].map((e) => quotaStanding(e, DATE));
    expect(entityQuota(ENTITY, staff)).toMatchObject({ base: 1, quota: 0 });
  });

  it('без квоти — лише кількість заброньованих', () => {
    const staff = [worker(reservedOwn)].map((e) => quotaStanding(e, DATE));
    expect(entityQuota({ ...ENTITY, reservationQuotaPercent: null }, staff)).toMatchObject({
      percent: null,
      quota: null,
      available: null,
      reservedCompany: 1,
      exceeded: false,
    });
  });
});
