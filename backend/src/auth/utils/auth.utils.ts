import { addressOf } from '../../documents/name-declension.js';
import { loadEnv } from '../../config/env.js';
import { APP_IDS } from '../../platform/contracts/apps.js';
import { passwordExpiresAt } from '../../common/utils/password-policy.utils.js';
import type { AuthUser, PasswordAgeFields } from '../../shared/interfaces/auth.interface.js';
/**
 * Only the public fields of a user (the entity also holds hashes and counters) + when the password expires.
 * `offerAccepted` — has the legal entity accepted the offer (OfferGateService); true when not required.
 */
export const toAuthUser = (u: AuthUser & Partial<PasswordAgeFields>, offerAccepted = true): AuthUser => {
  const env = loadEnv();
  const expires = passwordExpiresAt(
    { role: u.role, passwordChangedAt: u.passwordChangedAt ?? null },
    env.passwordMaxAgeDays,
    env.passwordExpiryRoles,
  );
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    legalEntityId: u.legalEntityId ?? null,
    mustChangePassword: u.mustChangePassword,
    passwordExpiresAt: expires ? expires.toISOString() : null,
    signupSource: u.signupSource ?? 'ADMIN',
    termsAccepted: offerAccepted,
    modules: modulesOf(u),
  };
};

/** The applications of the account; the main administrator — all of them. */
export function modulesOf(u: { role: string; modules?: string[] }): string[] {
  if (u.role === 'ADMIN') return [...APP_IDS];
  return (u.modules ?? ['oblik']).filter((m) => (APP_IDS as readonly string[]).includes(m));
}

/** The user for the frontend's session + how to address him («п. Галино») — for the greeting on the screen. */
export async function withAddress(user: AuthUser): Promise<AuthUser> {
  return { ...user, address: await addressOf(user.fullName) };
}
