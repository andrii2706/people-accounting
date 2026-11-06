import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import {
  AllowUnassigned,
  AllowPendingPasswordChange,
  AllowVendor,
  CurrentUser,
  Public,
} from '../common/decorators/auth.decorators.js';
import { BILLING_BLOCKED_MESSAGE, BILLING_DEBT_CODE } from '../billing/billing.constants.js';
import { BillingService } from '../billing/billing.service.js';
import { blockedMessage } from '../billing/utils/billing.utils.js';
import { passwordProblems } from '../common/utils/password-policy.utils.js';
import { fieldErrors } from '../common/validators/validators.js';
import { UpdatePreferencesDto } from '../users/users.dto.js';
import { UsersService } from '../users/users.service.js';
import { SessionService } from './session.service.js';
import type { AuthUser, SessionResponse } from '../shared/interfaces/auth.interface.js';
import { ChangePasswordDto, ResetPasswordDto } from './auth.dto.js';
import { LoginDto } from './auth.dto.js';
import { toAuthUser } from './utils/auth.utils.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  /** At most 5 attempts per minute from one address + account lockout after a series of failures. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    // Client IP — to investigate password guessing (correct only with a proper TRUST_PROXY_HOPS)
    const ip = req.ip ?? '';
    const result = await this.users.verifyCredentials(dto.email, dto.password);
    if (result.status === 'locked') {
      await this.audit.log('auth', result.userId, 'LOCKED', { email: [null, dto.email], ip: [null, ip] });
      const until = result.lockedUntil.toLocaleTimeString('uk-UA', {
        timeZone: 'Europe/Kyiv',
        hour: '2-digit',
        minute: '2-digit',
      });
      throw new UnauthorizedException(`Забагато невдалих спроб. Вхід заблоковано до ${until}`);
    }
    if (result.status === 'expired') {
      await this.audit.log('auth', result.userId, 'LOGIN_FAILED', { email: [null, dto.email], ip: [null, ip] });
      throw new UnauthorizedException(
        'Тимчасовий пароль прострочено — попросіть адміністратора видати новий (Налаштування → Користувачі → «Скинути пароль»)',
      );
    }
    if (result.status !== 'ok') {
      await this.audit.log('auth', result.userId ?? null, 'LOGIN_FAILED', { email: [null, dto.email], ip: [null, ip] });
      throw new UnauthorizedException('Невірний email або пароль');
    }
    const user = result.user;
    // a debt for using the system: one entry per user, then the sign-in is blocked until it is paid
    if ((await this.billing.loginGate(user)) === 'blocked') {
      await this.audit.log('auth', user.id, 'LOGIN_FAILED', { reason: [null, 'billing debt'], ip: [null, ip] });
      throw new ForbiddenException({
        statusCode: 403,
        code: BILLING_DEBT_CODE,
        message: blockedMessage(BILLING_BLOCKED_MESSAGE, await this.billing.paymentContact()),
      });
    }
    await this.sessions.issue(res, user);
    await this.audit.log('auth', user.id, 'LOGIN', { ip: [null, ip] }, user);
    return toAuthUser(user);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    this.sessions.clear(res);
  }

  /** Session check without a 401: { user: null } when not signed in. Used by the frontend (and SSR). */
  @Public()
  @Get('session')
  async session(@Req() req: Request): Promise<SessionResponse> {
    const token = (req.cookies as Record<string, string> | undefined)?.[this.sessions.cookieName];
    if (!token) return { user: null };
    const payload = await this.sessions.verify(token).catch(() => null);
    if (!payload || this.sessions.isExpiredAbsolutely(payload)) return { user: null };
    const user = await this.users.findForSession(payload.sub);
    if (!user?.isActive || user.tokenVersion !== payload.ver) return { user: null };
    return { user: toAuthUser(user) };
  }

  @AllowVendor()
  @AllowPendingPasswordChange()
  @AllowUnassigned()
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /** Change own password. All other sessions of the user are terminated. */
  @AllowVendor()
  @AllowPendingPasswordChange()
  @AllowUnassigned()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() current: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const problems = passwordProblems(dto.newPassword, current.email);
    if (problems.length) throw fieldErrors([{ field: 'newPassword', message: `Потрібно: ${problems.join(', ')}` }]);
    const user = await this.users.changeOwnPassword(current.id, dto.currentPassword, dto.newPassword);
    await this.sessions.issue(res, user);
    await this.audit.log('auth', user.id, 'PASSWORD_CHANGED', {}, current);
    return toAuthUser(user);
  }

  /** Who a link from a letter is for (the «new password» page); 400 — invalid / used / expired. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('password-reset/:token')
  passwordLink(@Param('token') token: string) {
    return this.users.passwordLinkInfo(token);
  }

  /** A new password by the link from a letter (expiry reminder or the administrator's request). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.users.resetWithLink(dto.token, dto.newPassword);
    this.sessions.clear(res);
    await this.audit.log('auth', user.id, 'PASSWORD_CHANGED', { byLink: [null, true] });
    return { email: user.email };
  }

  /** Own settings: e-mail reminders on / off. */
  @AllowUnassigned()
  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.users.preferences(user.id);
  }

  @AllowUnassigned()
  @Patch('preferences')
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.id, dto.notify);
  }
}
