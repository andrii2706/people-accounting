import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { loadEnv } from '../config/env.js';
import { SESSION_ALGORITHM, SESSION_AUDIENCE, SESSION_ISSUER } from '../platform/contracts/session.js';
import type { SessionPayload, SessionSubject } from '../shared/interfaces/auth.interface.js';
import { modulesOf } from './utils/auth.utils.js';

/**
 * Issues and extends the session in an httpOnly cookie.
 * Sliding timeout: the token lives SESSION_IDLE_MINUTES and is re-issued on activity,
 * but never longer than SESSION_MAX_HOURS since sign-in.
 *
 * With SESSION_SIGNING_KEY the session is signed with ES256 and carries the legal entity and the applications
 * of the account: portal, kadry and docs check it with the public key (JWKS) and cannot issue one themselves.
 * Without it — HS256 with JWT_SECRET, as before. Sessions signed the old way stay valid until they expire,
 * so turning the key on signs nobody out.
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
      // the whole domain: the portal and every application under /oblik/, /kadry/, /docs/ see the session
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
    const expiresIn = `${this.env.sessionIdleMinutes}m` as const;
    const key = this.env.sessionSigningKey;
    const token = key
      ? await this.jwt.signAsync(
          { ...payload, ent: user.legalEntityId ?? null, mods: modulesOf(user) },
          {
            algorithm: SESSION_ALGORITHM,
            // `secret`, not `privateKey`: the module's JWT_SECRET would win over `privateKey`
            secret: key.export({ type: 'pkcs8', format: 'pem' }).toString(),
            keyid: this.env.sessionKeyId,
            issuer: SESSION_ISSUER,
            audience: SESSION_AUDIENCE,
            expiresIn,
          },
        )
      : await this.jwt.signAsync(payload, { expiresIn });
    res.cookie(this.env.cookieName, token, this.cookieOptions());
  }

  clear(res: Response) {
    res.clearCookie(this.env.cookieName, { ...this.cookieOptions(), maxAge: undefined });
  }

  async verify(token: string): Promise<SessionPayload> {
    const payload = await this.verifySignature(token);
    // the ticket between the password and the code is never a session (it is also signed with another key)
    if ((payload as { typ?: unknown }).typ !== undefined) throw new Error('not a session');
    return payload;
  }

  private async verifySignature(token: string): Promise<SessionPayload> {
    const key = this.env.sessionSigningKey;
    if (!key) return this.jwt.verifyAsync<SessionPayload>(token);
    try {
      return await this.jwt.verifyAsync<SessionPayload>(token, {
        algorithms: [SESSION_ALGORITHM],
        secret: createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString(),
        issuer: SESSION_ISSUER,
        audience: SESSION_AUDIENCE,
      });
    } catch (err) {
      // a session issued before the key was set (HS256) — valid until it expires
      if (this.algorithmOf(token) === 'HS256') return this.jwt.verifyAsync<SessionPayload>(token);
      throw err;
    }
  }

  /** The public key for the other applications (GET /api/auth/.well-known/jwks.json); empty without the key. */
  jwks(): { keys: JsonWebKey[] } {
    const key = this.env.sessionSigningKey;
    if (!key) return { keys: [] };
    const jwk = createPublicKey(key).export({ format: 'jwk' });
    return { keys: [{ ...jwk, kid: this.env.sessionKeyId, alg: SESSION_ALGORITHM, use: 'sig' }] };
  }

  private algorithmOf(token: string): string | undefined {
    try {
      return (JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()) as { alg?: string }).alg;
    } catch {
      return undefined;
    }
  }

  isExpiredAbsolutely(payload: SessionPayload) {
    return Date.now() / 1000 - payload.sst > this.env.sessionMaxHours * 3600;
  }

  /** Re-issue when more than 5 minutes have passed (so the cookie is not rewritten on every request). */
  shouldRefresh(payload: SessionPayload) {
    return !!payload.iat && Date.now() / 1000 - payload.iat > 5 * 60;
  }
}
