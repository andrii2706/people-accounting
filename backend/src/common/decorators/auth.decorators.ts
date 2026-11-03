import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser, UserRole } from '../../shared/interfaces/auth.interface.js';
import { ALLOW_PENDING_PASSWORD, IS_PUBLIC, ROLES } from '../constants/auth.constants.js';

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
