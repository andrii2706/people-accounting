import { describe, expect, it } from 'vitest';
import { addMonths } from '../../common/utils/dates.utils.js';
import { EMPTY_SELLER } from '../subscriptions.constants.js';
import {
  daysLeft,
  gateOf,
  invoiceNumber,
  missingSellerFields,
  nextPeriod,
  paidUntilAfter,
  subscriptionState,
  vatSplit,
} from './subscription.utils.js';

const trial = { trialUntil: '2026-11-23', paidUntil: null };

describe('підписка', () => {
  it('стан і доступ: проба → прострочено → оплачено', () => {
    expect(subscriptionState(null, '2026-11-10')).toBe('NONE');
    expect(gateOf('NONE')).toBe('PLAN_REQUIRED');
    expect(subscriptionState(trial, '2026-11-23')).toBe('TRIAL');
    expect(subscriptionState(trial, '2026-11-24')).toBe('EXPIRED');
    expect(gateOf('EXPIRED')).toBe('EXPIRED');
    expect(subscriptionState({ ...trial, paidUntil: '2026-12-23' }, '2026-12-01')).toBe('ACTIVE');
    expect(gateOf('ACTIVE')).toBe('OK');
    expect(gateOf('TRIAL')).toBe('OK');
  });

  it('скільки днів лишилось (сьогодні включно)', () => {
    expect(daysLeft(trial, '2026-11-10')).toBe(14);
    expect(daysLeft(trial, '2026-11-30')).toBe(0);
    expect(daysLeft({ ...trial, paidUntil: '2026-12-23' }, '2026-12-23')).toBe(1);
  });

  it('період рахунку: після пробного, не раніше сьогодні', () => {
    expect(nextPeriod(trial, '2026-11-10', 1)).toEqual({ from: '2026-11-24', to: '2026-12-23' });
    expect(nextPeriod(trial, '2026-12-05', 1)).toEqual({ from: '2026-12-05', to: '2027-01-04' });
    expect(nextPeriod({ ...trial, paidUntil: '2026-12-23' }, '2026-12-20', 12)).toEqual({
      from: '2026-12-24',
      to: '2027-12-23',
    });
  });

  it('місяць від 31-го — останній день коротшого місяця', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-24', 12)).toBe('2027-11-24');
  });

  it('оплата не скорочує вже оплачений період', () => {
    expect(paidUntilAfter(null, '2026-12-23')).toBe('2026-12-23');
    expect(paidUntilAfter('2027-06-01', '2026-12-23')).toBe('2027-06-01');
  });

  it('ПДВ 20 % у тому числі', () => {
    expect(vatSplit(1200, true)).toEqual({ net: 1000, vatAmount: 200, total: 1200 });
    expect(vatSplit(749, true)).toEqual({ net: 624.17, vatAmount: 124.83, total: 749 });
    expect(vatSplit(749, false)).toEqual({ net: 749, vatAmount: 0, total: 749 });
  });

  it('без реквізитів рахунок не сформувати', () => {
    expect(missingSellerFields(EMPTY_SELLER)).toEqual(['name', 'code', 'address', 'iban', 'bank']);
    expect(
      missingSellerFields({
        ...EMPTY_SELLER,
        name: 'ТОВ «Приклад»',
        code: '00000000',
        address: 'м. Львів',
        iban: 'UA000000000000000000000000000',
        bank: 'АТ «Банк»',
      }),
    ).toEqual([]);
  });

  it('номер рахунку', () => {
    expect(invoiceNumber('ВО', 2026, 7)).toBe('ВО-2026-0007');
    expect(invoiceNumber('', 2026, 12)).toBe('2026-0012');
  });
});
