/** GET /api/billing/status — debt for using the system, shown after a sign-in. */
export interface BillingStatus {
  hasDebt: boolean;
  /** UAH; null — not shown. */
  amount: number | null;
  /** YYYY-MM-DD; null — not shown. */
  debtSince: string | null;
  /** Empty — not shown. */
  paymentContact: string;
}

/** GET /api/billing — the vendor page. */
export interface BillingRecord extends BillingStatus {
  debtSetAt: string | null;
  updatedAt: string | null;
  updatedBy: string;
  /** Users who have already used their one-time entry during the current debt. */
  graceUsedBy: number;
}

/** PUT /api/billing */
export interface UpdateBillingRequest {
  hasDebt: boolean;
  amount: number | null;
  debtSince: string | null;
  paymentContact: string;
}

/** The vendor form (text inputs). */
export interface BillingForm {
  hasDebt: boolean;
  amount: string;
  debtSince: string;
  paymentContact: string;
}
