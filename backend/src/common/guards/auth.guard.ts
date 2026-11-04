import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import type { Repository } from 'typeorm';
import { SessionService } from '../../auth/session.service.js';
import { User } from '../../users/user.entity.js';
import type { MaybeAuthenticatedRequest, UserRole } from '../../shared/interfaces/auth.interface.js';
import {
  ALLOW_DIRECTOR,
  ALLOW_PENDING_PASSWORD,
  ALLOW_VENDOR,
  IS_PUBLIC,
  PASSWORD_CHANGE_REQUIRED,
  READ_METHODS,
  ROLES,
} from '../constants/auth.constants.js';

/**
 * Global guard. The session is an httpOnly cookie only (Bearer tokens are deliberately not accepted).
 * Checks the user in the DB on every request: locked / password changed ⇒ the session is invalid immediately.
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
    const req = http.getRequest<MaybeAuthenticatedRequest>();
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

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };

    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, targets)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: PASSWORD_CHANGE_REQUIRED,
        message: 'Спершу змініть тимчасовий пароль',
      });
    }

    // the vendor account manages the payment status only and never reaches personal data
    if (user.role === 'VENDOR' && !this.reflector.getAllAndOverride<boolean>(ALLOW_VENDOR, targets)) {
      throw new ForbiddenException('Обліковий запис постачальника має доступ лише до сторінки оплати');
    }

    // the director sees everything and signs documents, but does not change the registration data
    if (
      user.role === 'DIRECTOR' &&
      !READ_METHODS.has(req.method) &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_DIRECTOR, targets)
    ) {
      throw new ForbiddenException('Роль «Директор» — перегляд і підписання документів, змінювати дані не можна');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('Недостатньо прав');

    // sliding idle timeout
    if (this.sessions.shouldRefresh(payload)) await this.sessions.issue(res, user, payload.sst);
    return true;
  }
}
