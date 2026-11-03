import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import { loadEnv } from '../config/env.js';
import type { SessionPayload, SessionSubject } from '../shared/interfaces/auth.interface.js';

/**
 * Issues and extends the session in an httpOnly cookie.
 * Sliding timeout: the token lives SESSION_IDLE_MINUTES and is re-issued on activity,
 * but never longer than SESSION_MAX_HOURS since sign-in.
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

  async issue(res: Response, user: SessionSubject, sessionStart?: number) {
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

  isExpiredAbsolutely(payload: SessionPayload) {
    return Date.now() / 1000 - payload.sst > this.env.sessionMaxHours * 3600;
  }

  /** Re-issue when more than 5 minutes have passed (so the cookie is not rewritten on every request). */
  shouldRefresh(payload: SessionPayload) {
    return !!payload.iat && Date.now() / 1000 - payload.iat > 5 * 60;
  }
}
