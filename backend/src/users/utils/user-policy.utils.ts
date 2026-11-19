import { APP_IDS } from '../../platform/contracts/apps.js';
import type { AuthUser, UserRole } from '../../shared/interfaces/auth.interface.js';
import { ROLES_ISSUED_BY_ENTITY, USER_ROLES } from '../users.constants.js';

/** Roles the actor may give: the main administrator — any; the entity administrator / director — HR and director. */
export function issuableRoles(actor: Pick<AuthUser, 'role'>): UserRole[] {
  return actor.role === 'ADMIN' ? USER_ROLES : ROLES_ISSUED_BY_ENTITY;
}

/**
 * May the actor manage the account: the main administrator — any; the entity administrator / director —
 * the HR and director accounts of his own legal entity (the entity administrator is appointed by the main one).
 */
export function canManage(
  actor: Pick<AuthUser, 'role' | 'legalEntityId'>,
  target: { role: UserRole; legalEntityId: string | null },
): boolean {
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'ENTITY_ADMIN' && actor.role !== 'DIRECTOR') return false;
  return (
    !!actor.legalEntityId &&
    target.legalEntityId === actor.legalEntityId &&
    ROLES_ISSUED_BY_ENTITY.includes(target.role)
  );
}

/** What is wrong with the legal entity of an account of the role (null — fine). */
export function roleEntityProblem(role: UserRole, legalEntityId: string | null): string | null {
  if (role === 'ADMIN' && legalEntityId)
    return 'Головний адміністратор бачить усі юрособи — не прив’язуйте його до однієї';
  if ((role === 'ENTITY_ADMIN' || role === 'HR') && !legalEntityId) return 'Оберіть юридичну особу';
  // a director may be without one: he adds his legal entity himself
  return null;
}

/**
 * The applications of an account as stored: known ids only, without repeats, in the order of the domain
 * (platform/contracts/apps); nothing chosen — «Військовий облік», as every account had before the portal.
 */
export function normalizeModules(modules: readonly string[] | undefined | null): string[] {
  const chosen = new Set((modules ?? []).map((m) => m.trim()));
  const known = APP_IDS.filter((id) => chosen.has(id));
  return known.length ? [...known] : ['oblik'];
}
