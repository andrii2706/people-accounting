import type { BillingSettingsView, PricingForm } from '../interfaces/subscription.interface';

/** «749», «1 250,50» → 749, 1250.5; empty — null (the plan is not offered); not a number — NaN. */
export function parsePrice(text: string): number | null {
  const t = text.replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return /^\d+(\.\d{1,2})?$/.test(t) ? n : Number.NaN;
}

export function pricingToForm(s: BillingSettingsView): PricingForm {
  const price = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
  return {
    seller: { ...s.seller },
    monthlyPrice: price(s.monthlyPrice),
    yearlyPrice: price(s.yearlyPrice),
    enterpriseText: s.enterpriseText,
    serviceName: s.serviceName,
    invoicePrefix: s.invoicePrefix,
    dueDays: s.dueDays,
    trialDays: s.trialDays,
  };
}
