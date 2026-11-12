import type { SignupRejectReason, SignupStatementRequest } from '../interfaces/auth.interface';
import type {
  InvoiceStatus,
  PlanCode,
  SellerDetails,
  SubscriptionState,
} from '../interfaces/subscription.interface';

/** The static line at the bottom of every page. */
export const COPYRIGHT_TEXT = '© ТОВ «ПАВ ІТ», 2026';

/** Error codes of the server (AuthGuard) the app reacts to. */
export const TERMS_REQUIRED = 'TERMS_REQUIRED';
export const PLAN_REQUIRED = 'PLAN_REQUIRED';
export const SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED';

export const PLAN_LABELS: Record<PlanCode, string> = {
  MONTHLY: 'Місячний',
  YEARLY: 'Річний',
  ENTERPRISE: 'Enterprise',
};

export const SUBSCRIPTION_STATE_LABELS: Record<SubscriptionState, string> = {
  NONE: 'тариф не обрано',
  TRIAL: 'пробний період',
  ACTIVE: 'оплачено',
  EXPIRED: 'доступ призупинено',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  ISSUED: 'очікує оплати',
  PAID: 'оплачено',
  CANCELLED: 'скасовано',
};

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

/** How long the app keeps the subscription state between navigations, ms. */
export const SUBSCRIPTION_CACHE_MS = 60_000;

/** The sign-up was refused (the signer is not the head per the ЄДР / the signature is invalid). */
export const SIGNUP_REJECTED = 'SIGNUP_REJECTED';

/** A legal entity's code in the ЄДР — 8 digits. */
export const SIGNUP_EDRPOU_PATTERN = /^\d{8}$/;

export const EMPTY_SIGNUP_FORM: SignupStatementRequest = {
  edrpou: '',
  email: '',
  consent: false,
  website: '',
};

/** Why a sign-up was refused — the administrator's list. */
export const SIGNUP_REASON_LABELS: Record<SignupRejectReason, string> = {
  SIGNATURE_INVALID: 'Підпис недійсний',
  CERT_EDRPOU_MISMATCH: 'У сертифікаті інший код ЄДРПОУ',
  NOT_IN_REGISTRY: 'Код не знайдено в ЄДР',
  TERMINATED: 'Юрособа припинена за ЄДР',
  NOT_HEAD: 'Підписант — не керівник за ЄДР',
  ENTITY_EXISTS: 'Юрособа вже зареєстрована',
};
