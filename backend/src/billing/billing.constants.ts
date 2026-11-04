/** The only row of `billing_status`. */
export const BILLING_ROW_ID = 1;

/** Error code of a sign-in blocked because of a debt — the frontend shows the message as is. */
export const BILLING_DEBT_CODE = 'BILLING_DEBT';

export const BILLING_BLOCKED_MESSAGE =
  'Вхід заблоковано: є заборгованість за користування системою. Повторний вхід стане можливим після погашення заборгованості.';

/** Upper bound of the debt amount, UAH. */
export const BILLING_MAX_AMOUNT = 10_000_000;
