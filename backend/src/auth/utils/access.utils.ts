import type { ModuleAccess } from '../../platform/contracts/apps.js';
import type { BillingLoginGate } from '../../shared/interfaces/billing.interface.js';
import type { SubscriptionGate } from '../../shared/interfaces/subscription.interface.js';
import { ACCESS_ACTIONS, ACCESS_TEXT } from '../access.constants.js';
import { BILLING_BLOCKED_MESSAGE, BILLING_GRACE_NOTICE } from '../../billing/billing.constants.js';
import { blockedMessage } from '../../billing/utils/billing.utils.js';

export interface AccessFacts {
  role: string;
  legalEntityId: string | null;
  mustChangePassword: boolean;
  /** The password reached its age limit (not a temporary one). */
  passwordExpired: boolean;
  termsAccepted: boolean;
  /** May choose the plan, pay and sign the offer of the legal entity. */
  manages: boolean;
  subscription: SubscriptionGate;
  billing: BillingLoginGate;
  paymentContact: string;
}

/**
 * The state of «Військовий облік» for the account, in the order the AuthGuard checks it: the password,
 * the offer, the legal entity, the plan / the paid period, the debt for the system.
 */
export function oblikAccess(f: AccessFacts): ModuleAccess {
  const closed = (state: ModuleAccess['state'], message: string, action?: ModuleAccess['action']): ModuleAccess => ({
    id: 'oblik',
    state,
    message,
    ...(action ? { action } : {}),
  });

  if (f.mustChangePassword) {
    return closed(
      'password',
      f.passwordExpired ? ACCESS_TEXT.passwordExpired : ACCESS_TEXT.passwordTemporary,
      ACCESS_ACTIONS.changePassword,
    );
  }
  const staff = f.role !== 'ADMIN' && f.role !== 'VENDOR';
  if (staff && !f.termsAccepted) {
    return f.manages
      ? closed('terms', ACCESS_TEXT.termsManager, ACCESS_ACTIONS.signTerms)
      : closed('terms', ACCESS_TEXT.termsStaff);
  }
  if (staff && !f.legalEntityId) {
    return f.role === 'DIRECTOR'
      ? closed('setup', ACCESS_TEXT.setupDirector, ACCESS_ACTIONS.addEntity)
      : closed('setup', ACCESS_TEXT.setupStaff);
  }
  if (staff && f.subscription === 'PLAN_REQUIRED') {
    return f.manages
      ? closed('payment', ACCESS_TEXT.planManager, ACCESS_ACTIONS.choosePlan)
      : closed('payment', ACCESS_TEXT.planStaff);
  }
  if (staff && f.subscription === 'EXPIRED') {
    return f.manages
      ? closed('payment', ACCESS_TEXT.expiredManager, ACCESS_ACTIONS.pay)
      : closed('payment', ACCESS_TEXT.expiredStaff);
  }
  if (f.billing === 'blocked') return closed('payment', blockedMessage(BILLING_BLOCKED_MESSAGE, f.paymentContact));
  const open: ModuleAccess = { id: 'oblik', state: 'open', message: '' };
  if (f.billing === 'grace') open.notice = blockedMessage(BILLING_GRACE_NOTICE, f.paymentContact);
  return open;
}
