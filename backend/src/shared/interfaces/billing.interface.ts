import type { IsoDate } from './common.interface.js';

/** Debt for using the system — what every signed-in user sees after a sign-in. */
export interface BillingStatus {
  hasDebt: boolean;
  /** Amount in UAH; null — not shown. */
  amount: number | null;
  /** Date the debt is counted from; null — not shown. */
  debtSince: IsoDate | null;
  /** Phone / e-mail / requisites for the payment; empty — not shown. */
  paymentContact: string;
}

/** Billing record for the vendor page: the status plus who changed it and when. */
export interface BillingRecord extends BillingStatus {
  /** When the current debt was set — users signed in after it have used their one-time entry. */
  debtSetAt: string | null;
  updatedAt: string | null;
  updatedBy: string;
  /** Users who have already used their one-time entry during the current debt. */
  graceUsedBy: number;
}

/** Result of the debt check at sign-in. */
export type BillingLoginGate = 'ok' | 'grace' | 'blocked';

/** Optional details of a debt set from the command line. */
export interface BillingDebtDetails {
  amount?: number;
  debtSince?: IsoDate;
  paymentContact?: string;
}

/** A command of `npm run billing -- …`. */
export type BillingCliCommand =
  | { kind: 'status' }
  | { kind: 'clear' }
  | { kind: 'debt'; details: BillingDebtDetails }
  /** No password — a random one is generated and printed once. */
  | { kind: 'create-vendor'; email: string; fullName: string; password?: string };
