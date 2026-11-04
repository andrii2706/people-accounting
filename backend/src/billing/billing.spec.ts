import { describe, expect, it } from 'vitest';
import { blockedMessage, graceUsed, toBillingStatus } from './utils/billing.utils.js';
import { parseBillingArgs } from './utils/billing-cli.utils.js';
import type { BillingStatusEntity } from './billing-status.entity.js';

const row = (patch: Partial<BillingStatusEntity>) =>
  ({
    id: 1,
    hasDebt: false,
    amount: null,
    debtSince: null,
    paymentContact: '',
    debtSetAt: null,
    updatedBy: '',
    updatedAt: new Date(),
    ...patch,
  }) as BillingStatusEntity;

describe('заборгованість за користування', () => {
  it('без боргу деталі не показуються', () => {
    expect(toBillingStatus(row({ amount: '1500.00', paymentContact: 'x' }))).toEqual({
      hasDebt: false,
      amount: null,
      debtSince: null,
      paymentContact: '',
    });
    expect(toBillingStatus(row({ hasDebt: true, amount: '1500.50', debtSince: '2026-11-01' }))).toMatchObject({
      hasDebt: true,
      amount: 1500.5,
      debtSince: '2026-11-01',
    });
  });

  it('одноразовий вхід рахується лише в межах поточного боргу', () => {
    const set = new Date('2026-11-04T10:00:00Z');
    expect(graceUsed(null, set)).toBe(false);
    // the entry was used during an earlier debt — a new debt gives a new one
    expect(graceUsed(new Date('2026-10-01T10:00:00Z'), set)).toBe(false);
    expect(graceUsed(new Date('2026-11-04T10:05:00Z'), set)).toBe(true);
  });

  it('повідомлення про блокування з контактом для оплати', () => {
    expect(blockedMessage('Вхід заблоковано.', '')).toBe('Вхід заблоковано.');
    expect(blockedMessage('Вхід заблоковано.', ' +380 67 000 00 00 ')).toBe(
      'Вхід заблоковано. Контакт для оплати: +380 67 000 00 00',
    );
  });

  it('команди npm run billing', () => {
    expect(parseBillingArgs([])).toEqual({ kind: 'status' });
    expect(parseBillingArgs(['--clear'])).toEqual({ kind: 'clear' });
    expect(
      parseBillingArgs(['--debt', '--amount', '1500,5', '--since', '2026-11-01', '--contact', 'тел. 123']),
    ).toEqual({
      kind: 'debt',
      details: { amount: 1500.5, debtSince: '2026-11-01', paymentContact: 'тел. 123' },
    });
    expect(() => parseBillingArgs(['--debt', '--since', '01.11.2026'])).toThrow('РРРР-ММ-ДД');
    expect(parseBillingArgs(['--create-vendor', 'v@example.com', 'Постачальник'])).toEqual({
      kind: 'create-vendor',
      email: 'v@example.com',
      fullName: 'Постачальник',
    });
    expect(parseBillingArgs(['--create-vendor', 'v@example.com', 'Постачальник', 'Secret123456'])).toEqual({
      kind: 'create-vendor',
      email: 'v@example.com',
      fullName: 'Постачальник',
      password: 'Secret123456',
    });
  });
});
