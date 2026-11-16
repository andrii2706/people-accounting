import { describe, expect, it } from 'vitest';
import type { Employee } from '../entities/employee.entity.js';
import { applyDeferral } from './employee-normalize.utils.js';

const card = (overrides: Partial<Employee>) =>
  ({
    reserved: false,
    deferralConscriptionBasis: '',
    deferralMobilizationBasis: '',
    deferralUntil: null,
    deferralUntilMobilizationEnd: false,
    nextVlkDate: null,
    partTimeNotInQuota: true,
    ...overrides,
  }) as Employee;

describe('відмітка «сумісник — не враховується у квоту»', () => {
  it('лишається разом із відстрочкою', () => {
    const e = card({ deferralMobilizationBasis: 'п. 9 ч. 1 ст. 23', deferralUntil: '2027-01-01' });
    applyDeferral(e);
    expect(e.partTimeNotInQuota).toBe(true);
  });

  it('знімається без відстрочки', () => {
    const e = card({});
    applyDeferral(e);
    expect(e.partTimeNotInQuota).toBe(false);
  });

  it('знімається, коли працівника заброньовано', () => {
    const e = card({ reserved: true, deferralMobilizationBasis: 'п. 9 ч. 1 ст. 23' });
    applyDeferral(e);
    expect(e.partTimeNotInQuota).toBe(false);
  });
});
