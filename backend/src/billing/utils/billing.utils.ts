import type { BillingStatus } from '../../shared/interfaces/billing.interface.js';
import type { BillingStatusEntity } from '../billing-status.entity.js';

/** What users see: the details only while there is a debt. */
export function toBillingStatus(row: BillingStatusEntity): BillingStatus {
  if (!row.hasDebt) return { hasDebt: false, amount: null, debtSince: null, paymentContact: '' };
  return {
    hasDebt: true,
    amount: row.amount === null ? null : Number(row.amount),
    debtSince: row.debtSince,
    paymentContact: row.paymentContact,
  };
}

/**
 * Was the one-time entry of the current debt already used? An entry before the debt was set does not count:
 * a new debt gives every user a new one-time entry.
 */
export function graceUsed(graceUsedAt: Date | null, debtSetAt: Date | null): boolean {
  if (!graceUsedAt) return false;
  return !debtSetAt || graceUsedAt >= debtSetAt;
}

/** The sign-in error: the fixed text plus the payment contact when it is set. */
export function blockedMessage(base: string, contact: string): string {
  return contact.trim() ? `${base} Контакт для оплати: ${contact.trim()}` : base;
}
