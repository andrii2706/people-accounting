import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import type { Repository } from 'typeorm';
import { SessionService } from '../auth/session.service.js';
import { User, type UserRole } from '../users/user.entity.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

const IS_PUBLIC = 'isPublic';
const ROLES = 'roles';
const ALLOW_PENDING_PASSWORD = 'allowPendingPassword';

/** Маршрут доступний без авторизації. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Обмежити маршрут ролями. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** Маршрут доступний навіть якщо користувач ще не змінив тимчасовий пароль. */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});

/** Код помилки, за яким фронтенд відкриває сторінку зміни пароля. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

/**
 * Глобальний guard. Сесія — лише httpOnly cookie (Bearer-токени свідомо не приймаються).
 * На кожен запит перевіряє користувача в БД: заблокований / змінений пароль ⇒ сесія недійсна одразу.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthUser }>();
    const res = http.getResponse<Response>();
    const token = (req.cookies as Record<string, string> | undefined)?.[this.sessions.cookieName];
    if (!token) throw new UnauthorizedException('Потрібна авторизація');

    const payload = await this.sessions.verify(token).catch(() => null);
    if (!payload || this.sessions.isExpiredAbsolutely(payload)) {
      this.sessions.clear(res);
      throw new UnauthorizedException('Сесія завершилась, увійдіть знову');
    }

    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.tokenVersion')
      .where('u.id = :id', { id: payload.sub })
      .getOne();
    if (!user || !user.isActive || user.tokenVersion !== payload.ver) {
      this.sessions.clear(res);
      throw new UnauthorizedException('Сесія недійсна, увійдіть знову');
    }

    req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, mustChangePassword: user.mustChangePassword };

    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, targets)) {
      throw new ForbiddenException({ statusCode: 403, code: PASSWORD_CHANGE_REQUIRED, message: 'Спершу змініть тимчасовий пароль' });
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('Недостатньо прав');

    // ковзний тайм-аут бездіяльності
    if (this.sessions.shouldRefresh(payload)) await this.sessions.issue(res, user, payload.sst);
    return true;
  }
}
