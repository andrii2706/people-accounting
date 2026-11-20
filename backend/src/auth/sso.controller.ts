import {
  createPublicKey,
  randomBytes,
  verify as verifySignature,
  type JsonWebKey as NodeJwk,
  type KeyObject,
} from 'node:crypto';
import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { IdentityRoute, Public } from '../common/decorators/auth.decorators.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import {
  SESSION_ALGORITHM,
  SESSION_ISSUER,
  SSO_TICKET_TYPE,
  type SsoTicketClaims,
} from '../platform/contracts/session.js';
import { clientIp } from '../security/utils/security.utils.js';
import type { UserRole } from '../shared/interfaces/auth.interface.js';
import { User } from '../users/user.entity.js';
import { BCRYPT_ROUNDS } from '../users/users.constants.js';
import { SessionService } from './session.service.js';

/** This module in the tickets of the portal (`aud`). */
const THIS_MODULE = 'oblik';
const ROLES: UserRole[] = ['ADMIN', 'ENTITY_ADMIN', 'DIRECTOR', 'HR'];
/** The keys of the portal are fetched again after this time (a new key of the portal is picked up). */
const JWKS_CACHE_MS = 10 * 60_000;

/**
 * The entrance from the portal (SSO). The portal — the core of the domain — signs the user in and checks the
 * payment; on a click it sends here a one-time ticket signed with its key. This module checks the ticket with
 * the public keys of the portal (PORTAL_JWKS_URL), finds its own account by the email (or adds it, tied to the
 * legal entity by ЄДРПОУ) and issues its own session. Its own sign-in (/login) works as before.
 * Without PORTAL_JWKS_URL the entrance is off.
 */
@ApiExcludeController()
@Public()
@IdentityRoute()
@Controller('auth')
export class SsoController {
  private readonly log = new Logger('SSO');
  private keys: { at: number; byKid: Map<string, KeyObject> } | null = null;
  /** Tickets already used (jti → expiry) — a ticket opens the module once. */
  private readonly used = new Map<string, number>();

  constructor(
    private readonly sessions: SessionService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  @Get('sso')
  async sso(@Query('ticket') ticket: string | undefined, @Req() req: Request, @Res() res: Response) {
    const claims = await this.check(ticket).catch((err: Error) => {
      this.log.warn(`квиток відхилено: ${err.message}`);
      return null;
    });
    // the base of this application on the domain: /oblik/ behind the portal, / alone
    const base = claims?.next?.startsWith('/oblik/') ? '/oblik/' : '/';
    if (!claims) return res.redirect(302, `${base}login?reason=sso`);

    const user = await this.accountOf(claims);
    if (!user?.isActive) return res.redirect(302, `${base}login?reason=sso`);
    await this.sessions.issue(res, user);
    await this.audit.log('auth', user.id, 'LOGIN', { via: [null, 'portal'], ip: [null, clientIp(req)] }, user);
    const next = claims.next.startsWith('/') && !claims.next.startsWith('//') ? claims.next : base;
    return res.redirect(302, next);
  }

  /** The signature (ES256, a key of the portal), the issuer, this module, not expired, not used. */
  private async check(ticket: string | undefined): Promise<SsoTicketClaims> {
    if (!process.env.PORTAL_JWKS_URL) throw new Error('PORTAL_JWKS_URL не задано — вхід з порталу вимкнено');
    const parts = (ticket ?? '').split('.');
    if (parts.length !== 3) throw new Error('не JWT');
    const [head, body, sig] = parts as [string, string, string];
    const header = JSON.parse(Buffer.from(head, 'base64url').toString()) as { alg?: string; kid?: string };
    if (header.alg !== SESSION_ALGORITHM) throw new Error(`алгоритм ${header.alg}`);
    const key = await this.keyOf(header.kid ?? '');
    const valid = verifySignature(
      'sha256',
      Buffer.from(`${head}.${body}`),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sig, 'base64url'),
    );
    if (!valid) throw new Error('підпис');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as SsoTicketClaims;
    const now = Math.floor(Date.now() / 1000);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== SESSION_ISSUER || !audience.includes(THIS_MODULE) || claims.typ !== SSO_TICKET_TYPE) {
      throw new Error('не квиток для цього модуля');
    }
    if (!claims.exp || claims.exp < now) throw new Error('квиток прострочено');
    for (const [jti, exp] of this.used) if (exp < now) this.used.delete(jti);
    if (!claims.jti || this.used.has(claims.jti)) throw new Error('квиток уже використано');
    this.used.set(claims.jti, claims.exp);
    if (!claims.email) throw new Error('без email');
    return claims;
  }

  private async keyOf(kid: string): Promise<KeyObject> {
    const fresh = this.keys && Date.now() - this.keys.at < JWKS_CACHE_MS;
    if (!fresh || !this.keys!.byKid.has(kid)) {
      const res = await fetch(process.env.PORTAL_JWKS_URL!, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`JWKS порталу: HTTP ${res.status}`);
      const { keys } = (await res.json()) as { keys: (NodeJwk & { kid?: string })[] };
      this.keys = {
        at: Date.now(),
        byKid: new Map(keys.map((k) => [k.kid ?? '', createPublicKey({ key: k, format: 'jwk' })])),
      };
    }
    const key = this.keys!.byKid.get(kid);
    if (!key) throw new Error('невідомий ключ');
    return key;
  }

  /** The account of this module with the email of the portal; a new one — tied to the legal entity by ЄДРПОУ. */
  private async accountOf(claims: SsoTicketClaims): Promise<User | null> {
    const users = this.dataSource.getRepository(User);
    const find = () =>
      users
        .createQueryBuilder('u')
        .addSelect('u.tokenVersion')
        .where('LOWER(u.email) = :email', { email: claims.email.trim().toLowerCase() })
        .getOne();
    const existing = await find();
    if (existing) return existing;
    const entity = claims.company?.code
      ? await this.dataSource.getRepository(LegalEntity).findOneBy({ edrpou: claims.company.code })
      : null;
    await users.save(
      users.create({
        email: claims.email.trim().toLowerCase(),
        fullName: claims.name || claims.email,
        role: ROLES.includes(claims.role as UserRole) ? (claims.role as UserRole) : 'HR',
        legalEntityId: entity?.id ?? null,
        modules: [THIS_MODULE],
        // the account signs in through the portal; its own password is unknown until reset here
        passwordHash: await bcrypt.hash(randomBytes(32).toString('base64url'), BCRYPT_ROUNDS),
      }),
    );
    this.log.log(`додано обліковий запис з порталу: ${claims.email}`);
    return find();
  }
}
