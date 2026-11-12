import type { UserRole } from '../shared/interfaces/auth.interface.js';
import type { PlanCode, SellerDetails } from '../shared/interfaces/subscription.interface.js';

/** The only row of `billing_settings`. */
export const BILLING_SETTINGS_ID = 1;

export const PLAN_CODES: PlanCode[] = ['MONTHLY', 'YEARLY', 'ENTERPRISE'];

export const PLAN_LABELS: Record<PlanCode, string> = {
  MONTHLY: 'Місячний',
  YEARLY: 'Річний',
  ENTERPRISE: 'Enterprise',
};

/** Months paid by one invoice of the plan (Enterprise — set on the invoice). */
export const PLAN_MONTHS: Record<Exclude<PlanCode, 'ENTERPRISE'>, number> = { MONTHLY: 1, YEARLY: 12 };

export const PLAN_PERIODS: Record<PlanCode, string> = {
  MONTHLY: 'за місяць',
  YEARLY: 'за рік',
  ENTERPRISE: 'індивідуально',
};

export const PLAN_DESCRIPTIONS: Record<PlanCode, string> = {
  MONTHLY: 'Повний доступ, оплата щомісяця. Можна перейти на річний у будь-який час.',
  YEARLY: 'Повний доступ на 12 місяців однією оплатою — вигідніше за помісячну.',
  ENTERPRISE:
    'Довготривала співпраця: індивідуальні умови, кілька юросіб, підключення власної бази даних. ' +
    'Залиште заявку — ми зв’яжемося й погодимо умови.',
};

/** Who chooses the plan and issues invoices of his legal entity. */
export const SUBSCRIPTION_MANAGERS: UserRole[] = ['ENTITY_ADMIN', 'DIRECTOR'];

export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_DUE_DAYS = 5;
export const DEFAULT_INVOICE_PREFIX = 'ВО';
export const DEFAULT_SERVICE_NAME = 'Послуги з надання доступу до програмного забезпечення «Військовий облік»';

/** VAT rate when the vendor pays VAT, %. */
export const VAT_RATE = 20;

/** Upper bound of a price / an invoice amount, UAH. */
export const MAX_PRICE = 10_000_000;

/** Error codes the frontend reacts to (redirects to the right page). */
export const TERMS_REQUIRED = 'TERMS_REQUIRED';
export const PLAN_REQUIRED = 'PLAN_REQUIRED';
export const SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED';

/** How long the guard keeps the access of a legal entity in memory, ms. */
export const GATE_CACHE_MS = 60_000;

export const EMPTY_SELLER: SellerDetails = {
  name: '',
  code: '',
  ipn: '',
  address: '',
  iban: '',
  bank: '',
  phone: '',
  email: '',
  taxNote: '',
  vatPayer: false,
  signerName: '',
  signerPosition: '',
};

/** Without these the invoice cannot be paid. */
export const REQUIRED_SELLER_FIELDS: (keyof SellerDetails)[] = ['name', 'code', 'address', 'iban', 'bank'];

/** The pseudo-sender of the letter of a self sign-up. */
export const SIGNUP_ISSUER = { fullName: 'Самостійна реєстрація', email: '' };
