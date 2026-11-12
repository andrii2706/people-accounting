import type { IsoDate } from './common.interface.js';

/** MONTHLY / YEARLY — a fixed price; ENTERPRISE — long-term cooperation on individual terms. */
export type PlanCode = 'MONTHLY' | 'YEARLY' | 'ENTERPRISE';

/** NONE — no plan chosen yet; TRIAL — the free period; ACTIVE — paid; EXPIRED — neither paid nor in trial. */
export type SubscriptionState = 'NONE' | 'TRIAL' | 'ACTIVE' | 'EXPIRED';

/** What the guard lets through: OK; PLAN_REQUIRED — choose a plan first; EXPIRED — only the payment page. */
export type SubscriptionGate = 'OK' | 'PLAN_REQUIRED' | 'EXPIRED';

export type InvoiceStatus = 'ISSUED' | 'PAID' | 'CANCELLED';

/** The terms a subscription is judged by. */
export interface SubscriptionTerms {
  trialUntil: IsoDate;
  paidUntil: IsoDate | null;
}

/** A plan as the client sees it. */
export interface PlanOffer {
  plan: PlanCode;
  label: string;
  /** UAH, the amount to pay (with VAT, if the vendor pays it); null — on request (Enterprise). */
  price: number | null;
  period: string;
  description: string;
}

/** Requisites of the seller (ТОВ «ПАВ ІТ») — entered by the vendor, printed on the invoices and the agreement. */
export interface SellerDetails {
  name: string;
  code: string;
  ipn: string;
  address: string;
  iban: string;
  bank: string;
  phone: string;
  email: string;
  taxNote: string;
  vatPayer: boolean;
  signerName: string;
  signerPosition: string;
}

/** Requisites of the buyer printed on an invoice (a snapshot of the legal entity). */
export interface BuyerDetails {
  name: string;
  code: string;
  address: string;
  phone: string;
}

/** Settings of the vendor: prices, the seller, the terms. */
export interface BillingSettingsView {
  seller: SellerDetails;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  enterpriseText: string;
  serviceName: string;
  invoicePrefix: string;
  dueDays: number;
  trialDays: number;
  /** All the requisites an invoice needs are filled. */
  ready: boolean;
}

export interface InvoiceView {
  id: string;
  number: string;
  plan: PlanCode;
  periodFrom: IsoDate;
  periodTo: IsoDate;
  issuedAt: IsoDate;
  dueDate: IsoDate;
  total: number;
  vatAmount: number;
  status: InvoiceStatus;
  paidAt: IsoDate | null;
  legalEntityId: string | null;
  buyerName: string;
}

/** GET /subscription — what the client sees on the payment page. */
export interface SubscriptionView {
  /** The legal entity works by subscription (signed up himself); false — the old flow, nothing to pay here. */
  required: boolean;
  state: SubscriptionState;
  plan: PlanCode | null;
  trialUntil: IsoDate | null;
  paidUntil: IsoDate | null;
  /** Days of access left (trial or paid); null — no term. */
  daysLeft: number | null;
  enterpriseRequestedAt: string | null;
  plans: PlanOffer[];
  invoices: InvoiceView[];
  /** The user may choose a plan and issue invoices (the director / the entity administrator). */
  canManage: boolean;
  /** The vendor has filled in the requisites — invoices can be issued. */
  sellerReady: boolean;
}

/** A subscription in the vendor's list. */
export interface VendorSubscriptionRow {
  id: string;
  legalEntityId: string | null;
  entityName: string;
  entityCode: string;
  ownerName: string;
  ownerEmail: string;
  plan: PlanCode;
  state: SubscriptionState;
  trialUntil: IsoDate;
  paidUntil: IsoDate | null;
  enterpriseRequestedAt: string | null;
  enterpriseNote: string;
  unpaidInvoices: number;
  createdAt: string;
}

/** The agreement shown before work starts. */
export interface TermsDocument {
  version: string;
  title: string;
  intro: string;
  sections: TermsSection[];
  seller: SellerDetails;
}

export interface TermsSection {
  title: string;
  paragraphs: string[];
}

export type OfferSignatureStatus = 'PENDING' | 'SIGNED';

/** The acceptance document offered for signing. */
export interface OfferDocument {
  id: string;
  fileName: string;
  /** The exact bytes to sign, base64 (UTF-8 text). */
  content: string;
}

/** GET /terms/status — where the legal entity of the user stands with the offer. */
export interface OfferStatus {
  version: string;
  /** The offer must be signed (a KEP check is configured and the user works in a legal entity). */
  required: boolean;
  signed: boolean;
  signedAt: Date | null;
  signerName: string;
  /** The head per the legal entity card — who must sign. */
  headName: string;
  entityName: string;
  /** The user may form the document and upload the head's signature (the director, the entity admin). */
  canSign: boolean;
  /** The IIT widget (signing right on the page). */
  widget: { enabled: boolean; scriptUrl: string; frameUrl: string };
}

/** What the acceptance document is built from. */
export interface OfferDocumentInput {
  id: string;
  createdAt: Date;
  terms: Pick<TermsDocument, 'version' | 'title' | 'intro' | 'sections'>;
  entity: { fullName: string; edrpou: string; address: string; headPosition: string; headName: string };
}
