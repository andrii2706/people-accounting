import type {
  BillingForm,
  BillingRecord,
  UpdateBillingRequest,
} from '../interfaces/billing.interface';

const UAH = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1500 → «1 500,00 грн». */
export function formatUah(amount: number): string {
  return `${UAH.format(amount)} грн`;
}

/** Text of the amount input → a number; empty → null; «1 500,50» is accepted. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  return clean ? Number(clean) : null;
}

export function billingToForm(r: BillingRecord): BillingForm {
  return {
    hasDebt: r.hasDebt,
    amount: r.amount === null ? '' : String(r.amount).replace('.', ','),
    debtSince: r.debtSince ?? '',
    paymentContact: r.paymentContact,
  };
}

export function formToBilling(f: BillingForm): UpdateBillingRequest {
  return {
    hasDebt: f.hasDebt,
    amount: parseAmount(f.amount),
    debtSince: f.debtSince || null,
    paymentContact: f.paymentContact.trim(),
  };
}
