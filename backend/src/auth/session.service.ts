import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import { loadEnv } from '../config/env.js';
import type { UserRole } from '../users/user.entity.js';

export interface SessionPayload {
  sub: string;
  /** Версія облікових даних користувача — після зміни пароля/блокування старі сесії недійсні. */
  ver: number;
  /** Початок сесії (сек) — для абсолютного ліміту тривалості. */
  sst: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Видача та продовження сесії в httpOnly cookie.
 * Ковзний тайм-аут: токен живе SESSION_IDLE_MINUTES і перевидається при активності,
 * але не довше SESSION_MAX_HOURS від входу.
 */
@Injectable()
export class SessionService {
  private readonly env = loadEnv();

  constructor(private readonly jwt: JwtService) {}

  get cookieName() {
    return this.env.cookieName;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: this.env.sessionIdleMinutes * 60_000,
    };
  }

  async issue(res: Response, user: { id: string; role: UserRole; tokenVersion: number }, sessionStart?: number) {
    const payload: SessionPayload = {
      sub: user.id,
      ver: user.tokenVersion,
      sst: sessionStart ?? Math.floor(Date.now() / 1000),
      role: user.role,
    };
    const token = await this.jwt.signAsync(payload, { expiresIn: `${this.env.sessionIdleMinutes}m` });
    res.cookie(this.env.cookieName, token, this.cookieOptions());
  }

  clear(res: Response) {
    res.clearCookie(this.env.cookieName, { ...this.cookieOptions(), maxAge: undefined });
  }

  verify(token: string) {
    return this.jwt.verifyAsync<SessionPayload>(token);
  }

  /** Сесія вичерпала абсолютний ліміт? */
  isExpiredAbsolutely(payload: SessionPayload) {
    return Date.now() / 1000 - payload.sst > this.env.sessionMaxHours * 3600;
  }

  /** Перевидати, якщо минуло понад 5 хв з видачі (щоб не писати cookie на кожен запит). */
  shouldRefresh(payload: SessionPayload) {
    return !!payload.iat && Date.now() / 1000 - payload.iat > 5 * 60;
  }
}
