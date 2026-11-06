import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser, Scope, UserRole } from '../../shared/interfaces/auth.interface.js';
import { entityScope } from '../utils/entity-scope.utils.js';
import {
  ALLOW_UNASSIGNED,
  ALLOW_PENDING_PASSWORD,
  ALLOW_VENDOR,
  IS_PUBLIC,
  ROLES,
} from '../constants/auth.constants.js';

/** Route without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Roles allowed on the route. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** Route available even before the user has changed a temporary password. */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

/** The signed-in user of the request. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});

/** Route open to the vendor account (it sees nothing else — no personal data). */
export const AllowVendor = () => SetMetadata(ALLOW_VENDOR, true);

/** Route open to an account without a legal entity (own profile, adding the legal entity by the director). */
export const AllowUnassigned = () => SetMetadata(ALLOW_UNASSIGNED, true);

/**
 * The legal entity whose data the request may touch: null — all (the main administrator),
 * otherwise the user's own. Every query of personal data is filtered by it.
 */
export const EntityScope = createParamDecorator((_: unknown, ctx: ExecutionContext): Scope => {
  return entityScope(ctx.switchToHttp().getRequest<AuthenticatedRequest>().user);
});
