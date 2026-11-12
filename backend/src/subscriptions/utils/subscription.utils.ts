import { addDays, addMonths, daysBetween } from '../../common/utils/dates.utils.js';
import type { IsoDate } from '../../shared/interfaces/common.interface.js';
import type {
  SellerDetails,
  SubscriptionGate,
  SubscriptionState,
  SubscriptionTerms,
} from '../../shared/interfaces/subscription.interface.js';
import { REQUIRED_SELLER_FIELDS, VAT_RATE } from '../subscriptions.constants.js';

/** Paid until a day — active; otherwise the free period; otherwise expired. */
export function subscriptionState(terms: SubscriptionTerms | null, today: IsoDate): SubscriptionState {
  if (!terms) return 'NONE';
  if (terms.paidUntil && terms.paidUntil >= today) return 'ACTIVE';
  if (terms.trialUntil >= today) return 'TRIAL';
  return 'EXPIRED';
}

/** What the guard lets through for a legal entity that works by subscription. */
export function gateOf(state: SubscriptionState): SubscriptionGate {
  if (state === 'NONE') return 'PLAN_REQUIRED';
  return state === 'EXPIRED' ? 'EXPIRED' : 'OK';
}

/** Days of access left, today included; null — no term. */
export function daysLeft(terms: SubscriptionTerms | null, today: IsoDate): number | null {
  if (!terms) return null;
  const end = terms.paidUntil && terms.paidUntil > terms.trialUntil ? terms.paidUntil : terms.trialUntil;
  return Math.max(0, daysBetween(today, end) + 1);
}

/**
 * The period of the next invoice: from the day after the paid period (or the free one) — not earlier than
 * today — for `months` months.
 */
export function nextPeriod(terms: SubscriptionTerms, today: IsoDate, months: number) {
  const covered = terms.paidUntil && terms.paidUntil > terms.trialUntil ? terms.paidUntil : terms.trialUntil;
  const after = addDays(covered, 1);
  const from = after > today ? after : today;
  return { from, to: addDays(addMonths(from, months), -1) };
}

/** A paid invoice extends the access to the end of its period (never shortens it). */
export function paidUntilAfter(paidUntil: IsoDate | null, periodTo: IsoDate): IsoDate {
  return paidUntil && paidUntil > periodTo ? paidUntil : periodTo;
}

/** The amount to pay split into «без ПДВ» and «ПДВ 20 %» (only when the seller pays VAT). */
export function vatSplit(total: number, vatPayer: boolean) {
  const cents = Math.round(total * 100);
  if (!vatPayer) return { net: cents / 100, vatAmount: 0, total: cents / 100 };
  const net = Math.round(cents / (1 + VAT_RATE / 100));
  return { net: net / 100, vatAmount: (cents - net) / 100, total: cents / 100 };
}

/** The requisites an invoice cannot do without, still empty. */
export function missingSellerFields(seller: SellerDetails): (keyof SellerDetails)[] {
  return REQUIRED_SELLER_FIELDS.filter((k) => !String(seller[k] ?? '').trim());
}

/** «ВО-2026-0007». */
export const invoiceNumber = (prefix: string, year: number, sequence: number) =>
  `${prefix ? `${prefix}-` : ''}${year}-${String(sequence).padStart(4, '0')}`;
