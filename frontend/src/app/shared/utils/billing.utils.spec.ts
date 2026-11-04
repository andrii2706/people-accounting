import { validateAmount } from '../validators/billing.validators';
import { billingToForm, formatUah, formToBilling, parseAmount } from './billing.utils';

describe('оплата за користування', () => {
  it('сума: формат і розбір', () => {
    expect(formatUah(1500).replace(/\s/g, ' ')).toBe('1 500,00 грн');
    expect(parseAmount('1 500,50')).toBe(1500.5);
    expect(parseAmount('')).toBeNull();
  });

  it('перевірка суми', () => {
    expect(validateAmount('')).toBeUndefined();
    expect(validateAmount('1500,5')).toBeUndefined();
    expect(validateAmount('1 500')).toBeUndefined();
    expect(validateAmount('15о0')?.message).toContain('Сума числом');
    expect(validateAmount('-5')?.message).toContain('Сума числом');
    expect(validateAmount('1,555')?.message).toContain('Сума числом');
    expect(validateAmount('20000000')?.message).toBe('Завелика сума');
  });

  it('форма ↔ запит', () => {
    const form = billingToForm({
      hasDebt: true,
      amount: 1500.5,
      debtSince: '2026-11-01',
      paymentContact: 'тел. 0',
      debtSetAt: null,
      updatedAt: null,
      updatedBy: '',
      graceUsedBy: 0,
    });
    expect(form.amount).toBe('1500,5');
    expect(formToBilling({ ...form, debtSince: '', paymentContact: '  ' })).toEqual({
      hasDebt: true,
      amount: 1500.5,
      debtSince: null,
      paymentContact: '',
    });
  });
});
