import type { BillingCliCommand } from '../../shared/interfaces/billing.interface.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Arguments of `npm run billing -- …` → a command; a mistake ends with a clear message. */
export function parseBillingArgs(argv: string[]): BillingCliCommand {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv.at(i + 1) : undefined;
  };
  if (argv.includes('--create-vendor')) {
    const i = argv.indexOf('--create-vendor');
    const [email, fullName, password] = argv.slice(i + 1, i + 4).filter((a) => !a.startsWith('--'));
    if (!email || !fullName) {
      throw new Error('Використання: --create-vendor <email> "<ПІБ>" ["<пароль>"]');
    }
    return { kind: 'create-vendor', email, fullName, ...(password && { password }) };
  }
  if (argv.includes('--clear')) return { kind: 'clear' };
  if (argv.includes('--debt')) {
    const amountText = value('--amount');
    const since = value('--since');
    const amount = amountText === undefined ? undefined : Number(amountText.replace(',', '.'));
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      throw new Error(`--amount: очікується сума, напр. 1500 (отримано «${amountText}»)`);
    }
    if (since !== undefined && !ISO_DATE.test(since)) {
      throw new Error(`--since: очікується дата РРРР-ММ-ДД (отримано «${since}»)`);
    }
    return {
      kind: 'debt',
      details: {
        ...(amount !== undefined && { amount }),
        ...(since !== undefined && { debtSince: since }),
        ...(value('--contact') !== undefined && { paymentContact: value('--contact') }),
      },
    };
  }
  return { kind: 'status' };
}
