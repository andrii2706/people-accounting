import { parseAmount } from '../utils/billing.utils';

/** The same limit as on the backend (BILLING_MAX_AMOUNT). */
const MAX_AMOUNT = 10_000_000;

/** Amount of the debt: empty, or a number ≥ 0 with at most 2 decimals. */
export function validateAmount(text: string) {
  const amount = parseAmount(text);
  if (amount === null) return undefined;
  if (!Number.isFinite(amount) || !/^\d+([.,]\d{1,2})?$/.test(text.replace(/\s/g, '')))
    return { kind: 'amount', message: 'Сума числом, напр. 1500 або 1500,50' };
  if (amount > MAX_AMOUNT) return { kind: 'amount', message: 'Завелика сума' };
  return undefined;
}
