import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser, Scope } from '../../shared/interfaces/auth.interface.js';

/** The legal entity of the user's data: null — all (the main administrator), otherwise his own. */
export function entityScope(user: AuthUser): Scope {
  if (user.role === 'ADMIN') return null;
  if (!user.legalEntityId) {
    throw new ForbiddenException('Обліковий запис ще не прив’язано до юридичної особи');
  }
  return user.legalEntityId;
}

/** Does a record of this legal entity fall within the scope? */
export function inScope(scope: Scope, legalEntityId: string | null | undefined): boolean {
  return scope === null || legalEntityId === scope;
}

/**
 * A record of another legal entity is answered exactly like a missing one —
 * no hint that it exists (ids cannot be probed).
 */
export function assertInScope(scope: Scope, legalEntityId: string | null | undefined, message = 'Запис не знайдено') {
  if (!inScope(scope, legalEntityId)) throw new NotFoundException(message);
}

/** Legal entity filter of a query: the scope wins over what the client asked for. */
export function scopedEntity(scope: Scope, requested: string | null | undefined): string | null {
  if (scope === null) return requested ?? null;
  assertInScope(scope, requested ?? scope, 'Юридичну особу не знайдено');
  return scope;
}
