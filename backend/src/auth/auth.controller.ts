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
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import {
  AllowPendingPasswordChange,
  AllowPendingTerms,
  AllowUnassigned,
  AllowUnpaid,
  AllowVendor,
  CurrentUser,
  IdentityRoute,
  Public,
} from '../common/decorators/auth.decorators.js';
import { LOGIN_ATTEMPTS_PER_MINUTE, MFA_ATTEMPTS_PER_MINUTE } from '../common/constants/auth.constants.js';
import { BILLING_BLOCKED_MESSAGE, BILLING_DEBT_CODE } from '../billing/billing.constants.js';
import { BillingService } from '../billing/billing.service.js';
import { OfferGateService } from '../subscriptions/offer-gate.service.js';
import { blockedMessage } from '../billing/utils/billing.utils.js';
import { passwordProblems } from '../common/utils/password-policy.utils.js';
import { fieldErrors } from '../common/validators/validators.js';
import { UpdatePreferencesDto } from '../users/users.dto.js';
import { UsersService } from '../users/users.service.js';
import { SessionService } from './session.service.js';
import type { AuthUser, SessionResponse } from '../shared/interfaces/auth.interface.js';
import {
  ChangePasswordDto,
  LoginCodeDto,
  LoginDto,
  LoginTicketDto,
  MfaCodeDto,
  MfaConfirmDto,
  MfaPasswordDto,
  ResetPasswordDto,
} from './auth.dto.js';
import type { LoginChallenge, TwoFactorEnabled, TwoFactorSetup } from '../platform/contracts/session.js';
import { SecurityService } from '../security/security.service.js';
import { actorOf, clientIp } from '../security/utils/security.utils.js';
import type { User } from '../users/user.entity.js';
import { MfaService } from './mfa.service.js';
import { toAuthUser, withAddress } from './utils/auth.utils.js';

@ApiTags('auth')
@IdentityRoute()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly offers: OfferGateService,
    private readonly mfa: MfaService,
    private readonly security: SecurityService,
  ) {}

  /**
   * A limit of attempts per minute from one address + account lockout after a series of failures.
   * With the code from the app on (or required for the role) the right password gives only a ticket
   * for the second step — the session is issued by /login/code or /login/enable.
   */
  @Public()
  @Throttle({ default: { limit: LOGIN_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser | LoginChallenge> {
    // Client IP — to investigate password guessing (correct only with a proper TRUST_PROXY_HOPS)
    const ip = clientIp(req);
    const result = await this.users.verifyCredentials(dto.email, dto.password);
    if (result.status === 'locked') {
      await this.audit.log('auth', result.userId, 'LOCKED', { email: [null, dto.email], ip: [null, ip] });
      if (result.fresh) await this.security.record('LOGIN_LOCKED', { ...actorOf(req), userId: result.userId });
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
      await this.security.checkLoginBurst(ip);
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
    const step = this.mfa.nextStep(user);
    if (step) return this.mfa.challenge(user, step);
    return this.signIn(user, req, res);
  }

  /** The second step: the code from the app (or a recovery code) for the ticket of the first one. */
  @Public()
  @Throttle({ default: { limit: MFA_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('login/code')
  @HttpCode(200)
  async loginCode(
    @Body() dto: LoginCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const user = await this.mfa.fromTicket(dto.ticket, 'CODE');
    const result = await this.mfa.checkCode(user, dto.code, actorOf(req, user));
    if (result.status === 'locked') {
      await this.audit.log('auth', user.id, 'LOCKED', { reason: [null, 'code'], ip: [null, clientIp(req)] });
      throw this.mfa.lockedError(result.lockedUntil);
    }
    if (result.status === 'invalid') {
      await this.audit.log('auth', user.id, 'LOGIN_FAILED', { reason: [null, 'code'], ip: [null, clientIp(req)] });
      throw new UnauthorizedException(
        `Невірний код. Перевірте, що час на телефоні правильний. Залишилось спроб: ${result.left}`,
      );
    }
    return this.signIn(user, req, res);
  }

  /** The first sign-in of a role that needs the code: a new secret for the app (QR). */
  @Public()
  @Throttle({ default: { limit: MFA_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('login/setup')
  @HttpCode(200)
  async loginSetup(@Body() dto: LoginTicketDto): Promise<TwoFactorSetup> {
    return this.mfa.begin(await this.mfa.fromTicket(dto.ticket, 'SETUP'));
  }

  /** …the first code from the app: the code is on, the person is signed in and sees the recovery codes once. */
  @Public()
  @Throttle({ default: { limit: MFA_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('login/enable')
  @HttpCode(200)
  async loginEnable(
    @Body() dto: LoginCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TwoFactorEnabled<AuthUser>> {
    const user = await this.mfa.fromTicket(dto.ticket, 'SETUP');
    const recoveryCodes = await this.mfa.enable(user, dto.code, actorOf(req, user));
    await this.audit.log('auth', user.id, 'MFA_CHANGED', { mfa: [null, 'on'] }, user);
    return { user: await this.signIn(user, req, res), recoveryCodes };
  }

  /** The session, the journal entry, and «a sign-in from a new device» for the person. */
  private async signIn(user: User, req: Request, res: Response): Promise<AuthUser> {
    await this.sessions.issue(res, user);
    await this.audit.log('auth', user.id, 'LOGIN', { ip: [null, clientIp(req)] }, user);
    await this.security.trackDevice(user, req, res);
    return withAddress(toAuthUser(user, await this.offers.accepted(user)));
  }

  /** The public key of the shared session — portal, kadry and docs check the session with it. */
  @Public()
  @SkipThrottle()
  @Get('.well-known/jwks.json')
  jwks() {
    return this.sessions.jwks();
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
    return { user: await withAddress(toAuthUser(user, await this.offers.accepted(user))) };
  }

  @AllowVendor()
  @AllowPendingPasswordChange()
  @AllowPendingTerms()
  @AllowUnpaid()
  @AllowUnassigned()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return withAddress(user);
  }

  /** Change own password. All other sessions of the user are terminated. */
  @AllowVendor()
  @AllowPendingPasswordChange()
  @AllowPendingTerms()
  @AllowUnpaid()
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
    return withAddress(toAuthUser(user, current.termsAccepted ?? true));
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

  /** Own account: is the code from the app on, how many recovery codes are left. */
  @AllowVendor()
  @AllowPendingTerms()
  @AllowUnpaid()
  @AllowUnassigned()
  @Get('mfa')
  mfaStatus(@CurrentUser() user: AuthUser) {
    return this.mfa.status(user.id);
  }

  /** Own account: a new secret for the app — after the password once more. */
  @AllowVendor()
  @AllowPendingTerms()
  @AllowUnpaid()
  @AllowUnassigned()
  @Throttle({ default: { limit: MFA_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('mfa/setup')
  @HttpCode(200)
  mfaSetup(@Body() dto: MfaPasswordDto, @CurrentUser() user: AuthUser): Promise<TwoFactorSetup> {
    return this.mfa.beginOwn(user.id, dto.password);
  }

  @AllowVendor()
  @AllowPendingTerms()
  @AllowUnpaid()
  @AllowUnassigned()
  @Throttle({ default: { limit: MFA_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('mfa/enable')
  @HttpCode(200)
  async mfaEnable(@Body() dto: MfaCodeDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const recoveryCodes = await this.mfa.enableOwn(user.id, dto.code, actorOf(req, user));
    await this.audit.log('auth', user.id, 'MFA_CHANGED', { mfa: [null, 'on'] }, user);
    return { recoveryCodes, status: await this.mfa.status(user.id) };
  }

  /** Own account: turn the code off — only where the role does not require it. */
  @AllowVendor()
  @AllowPendingTerms()
  @AllowUnpaid()
  @AllowUnassigned()
  @Throttle({ default: { limit: MFA_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('mfa/disable')
  @HttpCode(200)
  async mfaDisable(@Body() dto: MfaConfirmDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const status = await this.mfa.disable(user.id, dto.password, dto.code, actorOf(req, user));
    await this.audit.log('auth', user.id, 'MFA_CHANGED', { mfa: ['on', null] }, user);
    return status;
  }

  /** Own account: ten new recovery codes; the old ones stop working. */
  @AllowVendor()
  @AllowPendingTerms()
  @AllowUnpaid()
  @AllowUnassigned()
  @Throttle({ default: { limit: MFA_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  @Post('mfa/recovery-codes')
  @HttpCode(200)
  async mfaRecoveryCodes(@Body() dto: MfaConfirmDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const recoveryCodes = await this.mfa.renewCodes(user.id, dto.password, dto.code, actorOf(req, user));
    return { recoveryCodes, status: await this.mfa.status(user.id) };
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
