import { describe, expect, it } from 'vitest';
import { blockedMessage, graceUsed, sessionGate, toBillingStatus } from './utils/billing.utils.js';
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

describe('sessionGate — a debt closes the module, not the sign-in', () => {
  const set = new Date('2026-11-04T09:00:00Z');
  const debt = { hasDebt: true, debtSetAt: set };
  const entry = new Date('2026-11-04T10:00:00Z');
  const sec = (d: Date) => Math.floor(d.getTime() / 1000);

  it('no debt or the vendor → ok', () => {
    expect(sessionGate({ hasDebt: false, debtSetAt: null }, { role: 'HR', debtGraceUsedAt: null }, 0)).toBe('ok');
    expect(sessionGate(debt, { role: 'VENDOR', debtGraceUsedAt: null }, 0)).toBe('ok');
  });

  it('the session of the one entry works, an older or a later one is closed', () => {
    const user = { role: 'HR', debtGraceUsedAt: entry };
    expect(sessionGate(debt, user, sec(entry))).toBe('grace');
    expect(sessionGate(debt, user, sec(entry) + 1)).toBe('grace');
    expect(sessionGate(debt, user, sec(entry) + 5)).toBe('blocked'); // signed in again a few seconds later
    expect(sessionGate(debt, user, sec(new Date('2026-11-04T08:00:00Z')))).toBe('blocked');
    expect(sessionGate(debt, user, sec(new Date('2026-11-04T12:00:00Z')))).toBe('blocked');
  });

  it('no entry during this debt yet (a session from before it) → closed', () => {
    expect(sessionGate(debt, { role: 'HR', debtGraceUsedAt: null }, sec(entry))).toBe('blocked');
    expect(sessionGate(debt, { role: 'HR', debtGraceUsedAt: new Date('2026-10-01') }, sec(entry))).toBe('blocked');
  });
});
