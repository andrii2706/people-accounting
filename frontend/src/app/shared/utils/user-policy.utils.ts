import { ENTITY_ISSUED_ROLES } from '../constants/auth.constants';
import type { AuthUser, ManagedUser, UserRole } from '../interfaces/auth.interface';

/**
 * May the user manage the account (the server checks the same): the main administrator — any;
 * the entity administrator / director — the HR and director accounts of his legal entity.
 */
export function canManageUser(
  actor: Pick<AuthUser, 'role' | 'legalEntityId'> | null,
  target: Pick<ManagedUser, 'role' | 'legalEntityId'>,
): boolean {
  if (!actor) return false;
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'ENTITY_ADMIN' && actor.role !== 'DIRECTOR') return false;
  return (
    !!actor.legalEntityId &&
    target.legalEntityId === actor.legalEntityId &&
    ENTITY_ISSUED_ROLES.includes(target.role)
  );
}

/** Roles that need a legal entity (the director may be without one — he adds his). */
export function roleNeedsEntity(role: UserRole): boolean {
  return role === 'ENTITY_ADMIN' || role === 'HR';
}
