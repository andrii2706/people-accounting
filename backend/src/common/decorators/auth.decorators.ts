import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser, UserRole } from '../../shared/interfaces/auth.interface.js';
import { ALLOW_DIRECTOR, ALLOW_PENDING_PASSWORD, ALLOW_VENDOR, IS_PUBLIC, ROLES } from '../constants/auth.constants.js';

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

/** A changing route the director may call too (signing, own password, own reminders, inbox). */
export const AllowDirector = () => SetMetadata(ALLOW_DIRECTOR, true);
