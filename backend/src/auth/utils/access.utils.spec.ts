import { describe, expect, it } from 'vitest';
import { oblikAccess, type AccessFacts } from './access.utils.js';

const ok: AccessFacts = {
  role: 'HR',
  legalEntityId: 'e-1',
  mustChangePassword: false,
  passwordExpired: false,
  termsAccepted: true,
  manages: false,
  subscription: 'OK',
  billing: 'ok',
  paymentContact: '',
};

describe('oblikAccess — what the portal shows on the tile', () => {
  it('everything in order → open', () => {
    expect(oblikAccess(ok)).toEqual({ id: 'oblik', state: 'open', message: '' });
  });

  it('an out-of-date password → closed, «change the password»', () => {
    const a = oblikAccess({ ...ok, mustChangePassword: true, passwordExpired: true });
    expect(a).toMatchObject({ state: 'password', action: { path: '/change-password' } });
    expect(a.message).toMatch(/пароль застарів/);
    expect(oblikAccess({ ...ok, mustChangePassword: true }).message).toMatch(/тимчасовий/);
  });

  it('the password goes first — before the payment', () => {
    expect(oblikAccess({ ...ok, mustChangePassword: true, billing: 'blocked' }).state).toBe('password');
  });

  it('a debt for the system → payment, with the contact', () => {
    const a = oblikAccess({ ...ok, billing: 'blocked', paymentContact: 'pay@vendor.ua' });
    expect(a.state).toBe('payment');
    expect(a.message).toMatch(/оплату/);
    expect(a.message).toContain('pay@vendor.ua');
  });

  it('the one entry of a debt → open with a warning', () => {
    const a = oblikAccess({ ...ok, billing: 'grace' });
    expect(a.state).toBe('open');
    expect(a.notice).toMatch(/останній вхід/);
  });

  it('no plan / the paid period over: the head pays, the staff is told whom to ask', () => {
    expect(oblikAccess({ ...ok, subscription: 'EXPIRED', manages: true, role: 'DIRECTOR' })).toMatchObject({
      state: 'payment',
      action: { label: 'Оплатити', path: '/oblik/account/subscription' },
    });
    const staff = oblikAccess({ ...ok, subscription: 'EXPIRED' });
    expect(staff.action).toBeUndefined();
    expect(staff.message).toMatch(/керівника/);
    expect(oblikAccess({ ...ok, subscription: 'PLAN_REQUIRED', manages: true }).action?.path).toBe(
      '/oblik/account/plans',
    );
  });

  it('the offer and the legal entity', () => {
    expect(oblikAccess({ ...ok, termsAccepted: false, manages: true }).state).toBe('terms');
    expect(oblikAccess({ ...ok, legalEntityId: null }).state).toBe('setup');
  });

  it('the main administrator is not stopped by the plan or the offer', () => {
    expect(oblikAccess({ ...ok, role: 'ADMIN', legalEntityId: null, termsAccepted: false }).state).toBe('open');
    expect(oblikAccess({ ...ok, role: 'ADMIN', billing: 'blocked' }).state).toBe('payment');
  });
});
