import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { AllowPendingPasswordChange, type AuthUser, CurrentUser, Public } from '../common/auth.js';
import { passwordMessage, passwordProblems } from '../common/password-policy.js';
import { Rule } from '../common/validators.js';
import { UpdatePreferencesDto } from '../users/users.dto.js';
import { UsersService } from '../users/users.service.js';
import { SessionService } from './session.service.js';

class LoginDto {
  @IsEmail({}, { message: 'Некоректний email' }) @MaxLength(200) email: string;
  @IsString() @MaxLength(200) password: string;
}

class ChangePasswordDto {
  @IsString() @MaxLength(200) currentPassword: string;
  @IsString() @MaxLength(200)
  @Rule((v: string) => passwordProblems(v).length === 0, 'Пароль: щонайменше 12 символів, літери й цифри')
  newPassword: string;
}

const toAuthUser = (u: { id: string; email: string; fullName: string; role: AuthUser['role']; mustChangePassword: boolean }): AuthUser => ({
  id: u.id, email: u.email, fullName: u.fullName, role: u.role, mustChangePassword: u.mustChangePassword,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
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
      const until = result.lockedUntil.toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });
      throw new UnauthorizedException(`Забагато невдалих спроб. Вхід заблоковано до ${until}`);
    }
    if (result.status !== 'ok') {
      await this.audit.log('auth', result.userId ?? null, 'LOGIN_FAILED', { email: [null, dto.email], ip: [null, ip] });
      throw new UnauthorizedException('Невірний email або пароль');
    }
    const user = result.user;
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
  async session(@Req() req: Request): Promise<{ user: AuthUser | null }> {
    const token = (req.cookies as Record<string, string> | undefined)?.[this.sessions.cookieName];
    if (!token) return { user: null };
    const payload = await this.sessions.verify(token).catch(() => null);
    if (!payload || this.sessions.isExpiredAbsolutely(payload)) return { user: null };
    const user = await this.users.findForSession(payload.sub);
    if (!user?.isActive || user.tokenVersion !== payload.ver) return { user: null };
    return { user: toAuthUser(user) };
  }

  @AllowPendingPasswordChange()
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /** Change own password. All other sessions of the user are terminated. */
  @AllowPendingPasswordChange()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() current: AuthUser, @Res({ passthrough: true }) res: Response) {
    const problems = passwordProblems(dto.newPassword, current.email);
    if (problems.length) throw new UnauthorizedException(passwordMessage(problems));
    const user = await this.users.changeOwnPassword(current.id, dto.currentPassword, dto.newPassword);
    await this.sessions.issue(res, user);
    await this.audit.log('auth', user.id, 'PASSWORD_CHANGED', {}, current);
    return toAuthUser(user);
  }

  /** Own settings: e-mail reminders on / off. */
  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.users.preferences(user.id);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.id, dto.notify);
  }
}
