/** The only row of `billing_status`. */
export const BILLING_ROW_ID = 1;

/** Error code of a module closed because of a debt — the frontend shows the message as is. */
export const BILLING_DEBT_CODE = 'BILLING_DEBT';

/** The sign-in itself is never blocked: the portal opens and says why the module is closed. */
export const BILLING_BLOCKED_MESSAGE =
  'Модуль недоступний: є заборгованість за користування системою. Зробіть оплату — доступ відновиться після погашення заборгованості.';

/** The one entry left during a debt: the module works, the portal warns. */
export const BILLING_GRACE_NOTICE =
  'Є заборгованість за користування системою. Це останній вхід до оплати — наступного разу модуль буде закрито.';

/**
 * The entry that used the one-time access of a debt: its session is issued right after the entry is recorded
 * (the session start is in whole seconds — hence a second before). Any later sign-in is closed.
 */
export const GRACE_SESSION_WINDOW_MS = { before: 1_500, after: 2_000 } as const;

/** How long the guard keeps the debt state in memory, ms (a change on this instance forgets it at once). */
export const BILLING_CACHE_MS = 30_000;

/** Upper bound of the debt amount, UAH. */
export const BILLING_MAX_AMOUNT = 10_000_000;
