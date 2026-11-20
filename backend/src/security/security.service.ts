import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { loadEnv } from '../config/env.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';
import type {
  ExportTrace,
  SecurityActor,
  SecurityEventKind,
  SecurityEventsPage,
  SecurityEventView,
} from '../shared/interfaces/security.interface.js';
import { User } from '../users/user.entity.js';
import { ExportUsage } from './entities/export-usage.entity.js';
import { SecurityEvent } from './entities/security-event.entity.js';
import { UserDevice } from './entities/user-device.entity.js';
import {
  DEVICE_COOKIE_DAYS,
  LOGIN_BURST_ACCOUNTS,
  LOGIN_BURST_FAILURES,
  LOGIN_BURST_WINDOW_MINUTES,
  SECURITY_KEEP_DAYS,
  SECURITY_PAGE_MAX,
  SECURITY_PAGE_SIZE,
  SECURITY_POLICIES,
  SECURITY_TITLES,
} from './security.constants.js';
import { deviceHash, deviceLabel, securityLetter } from './utils/security.utils.js';

const MINUTE = 60_000;

/**
 * Notices what looks like a break-in or a leak and tells the people who can act: the person whose account it is,
 * the administrators / director of the legal entity, the main administrators. Never throws — a journal entry
 * or a letter must not break the sign-in or the download.
 */
@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly env = loadEnv();

  constructor(
    @InjectRepository(SecurityEvent) private readonly events: Repository<SecurityEvent>,
    @InjectRepository(UserDevice) private readonly devices: Repository<UserDevice>,
    @InjectRepository(ExportUsage) private readonly exports: Repository<ExportUsage>,
    @InjectRepository(AuditLog) private readonly audit: Repository<AuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  /** Writes the event and, by its policy, sends the letters (not twice within the quiet period). */
  async record(
    kind: SecurityEventKind,
    actor: SecurityActor,
    details: Record<string, string | number | boolean> = {},
  ): Promise<SecurityEvent | null> {
    try {
      const policy = SECURITY_POLICIES[kind];
      actor = await this.enrich(actor);
      // the same thing again within the quiet period (a wave of guesses, every next card) — one row, counted
      const recent = policy.merge ? await this.recent(kind, actor, policy.quietMinutes) : null;
      if (recent) {
        const repeats = Number(recent.details.repeats ?? 1) + 1;
        await this.events.update(recent.id, { details: { ...recent.details, ...details, repeats } });
        return recent;
      }
      const event = await this.events.save(
        this.events.create({
          kind,
          level: policy.level,
          userId: actor.userId ?? null,
          userName: (actor.userName ?? '').slice(0, 200),
          legalEntityId: actor.legalEntityId ?? null,
          ip: actor.ip ?? '',
          device: actor.userAgent ? deviceLabel(actor.userAgent) : '',
          details,
        }),
      );
      if (await this.quiet(event, policy.quietMinutes)) return event;
      const to = await this.recipients(event, actor.email, policy);
      if (to.length) {
        const letter = securityLetter(event, this.env.appUrl);
        if (await this.notifications.sendTo(to, letter.subject, letter.text)) {
          await this.events.update(event.id, { notified: true });
          event.notified = true;
        }
      }
      return event;
    } catch (err) {
      this.logger.error(`Не вдалося записати подію безпеки ${kind}`, err as Error);
      return null;
    }
  }

  /** Only the account id is known (a lockout): the name, e-mail and legal entity are looked up. */
  private async enrich(actor: SecurityActor): Promise<SecurityActor> {
    if (!actor.userId || (actor.userName && actor.legalEntityId !== undefined && actor.email)) return actor;
    const user = await this.users.findOne({
      where: { id: actor.userId },
      select: { id: true, fullName: true, email: true, legalEntityId: true },
    });
    if (!user) return actor;
    return {
      ...actor,
      userName: actor.userName || user.fullName,
      email: actor.email ?? user.email,
      legalEntityId: actor.legalEntityId ?? user.legalEntityId,
    };
  }

  /** A letter about the same kind and account (or address) has been sent within the quiet period. */
  private quiet(event: SecurityEvent, minutes: number) {
    if (!minutes) return Promise.resolve(false);
    return this.events.existsBy({
      kind: event.kind,
      notified: true,
      createdAt: MoreThan(new Date(Date.now() - minutes * MINUTE)),
      ...(event.userId ? { userId: event.userId } : { ip: event.ip }),
    });
  }

  /** The same kind about the same account (or, without one, the same address) within the last minutes. */
  private recent(kind: SecurityEventKind, actor: SecurityActor, minutes: number) {
    return this.events.findOne({
      where: {
        kind,
        createdAt: MoreThan(new Date(Date.now() - minutes * MINUTE)),
        ...(actor.userId
          ? { userId: actor.userId }
          : actor.legalEntityId
            ? { legalEntityId: actor.legalEntityId, ip: actor.ip ?? '' }
            : { ip: actor.ip ?? '' }),
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async recipients(event: SecurityEvent, email: string | undefined, policy = SECURITY_POLICIES[event.kind]) {
    const to = new Set<string>();
    if (policy.toUser) {
      const own =
        email ??
        (event.userId
          ? (await this.users.findOne({ where: { id: event.userId }, select: { email: true } }))?.email
          : '');
      if (own) to.add(own);
    }
    if (policy.toManagers) {
      const managers = await this.users.find({
        where: [
          { isActive: true, role: 'ADMIN' as const },
          ...(event.legalEntityId
            ? [{ isActive: true, legalEntityId: event.legalEntityId, role: In(['ENTITY_ADMIN', 'DIRECTOR']) }]
            : []),
        ],
        select: { email: true },
      });
      for (const m of managers) to.add(m.email);
      for (const e of this.env.securityAlertEmails) to.add(e);
    }
    return [...to];
  }

  /**
   * After a successful sign-in: a browser this account has never used gets a device cookie and the person
   * a letter (the very first browser of an account is not reported — there is nothing to compare with).
   */
  async trackDevice(user: Pick<AuthUser, 'id' | 'fullName' | 'email' | 'legalEntityId'>, req: Request, res: Response) {
    try {
      const cookies = (req.cookies ?? {}) as Record<string, string>;
      let deviceId = cookies[this.env.deviceCookieName];
      if (!deviceId || !/^[A-Za-z0-9_-]{20,64}$/.test(deviceId)) deviceId = randomBytes(24).toString('base64url');
      res.cookie(this.env.deviceCookieName, deviceId, {
        httpOnly: true,
        secure: this.env.cookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: DEVICE_COOKIE_DAYS * 24 * 60 * MINUTE,
      });
      const hash = deviceHash(user.id, deviceId);
      const ip = (req.ip ?? '').replace(/^::ffff:/, '');
      const userAgent = String(req.headers['user-agent'] ?? '');
      const known = await this.devices.findOneBy({ userId: user.id, deviceHash: hash });
      if (known) {
        await this.devices.update(known.id, { lastSeenAt: new Date(), lastIp: ip });
        return;
      }
      const before = await this.devices.countBy({ userId: user.id });
      await this.devices.save(
        this.devices.create({ userId: user.id, deviceHash: hash, label: deviceLabel(userAgent), lastIp: ip }),
      );
      if (before > 0) {
        await this.record('NEW_DEVICE', {
          userId: user.id,
          userName: user.fullName,
          email: user.email,
          legalEntityId: user.legalEntityId,
          ip,
          userAgent,
        });
      }
    } catch (err) {
      this.logger.error('Не вдалося перевірити пристрій', err as Error);
    }
  }

  /**
   * After a failed sign-in: many failures from one address into different accounts within minutes —
   * somebody runs a list of passwords (the lockout of each account alone does not show it).
   */
  async checkLoginBurst(ip: string) {
    if (!ip) return;
    try {
      const since = new Date(Date.now() - LOGIN_BURST_WINDOW_MINUTES * MINUTE);
      const rows = await this.audit
        .createQueryBuilder('a')
        .select('COUNT(*)', 'failures')
        .addSelect(`COUNT(DISTINCT a.diff->'email'->>1)`, 'accounts')
        .where('a.action = :action', { action: 'LOGIN_FAILED' })
        .andWhere('a.createdAt > :since', { since })
        .andWhere(`a.diff->'ip'->>1 = :ip`, { ip })
        .getRawOne<{ failures: string; accounts: string }>();
      const failures = Number(rows?.failures ?? 0);
      const accounts = Number(rows?.accounts ?? 0);
      if (failures >= LOGIN_BURST_FAILURES && accounts >= LOGIN_BURST_ACCOUNTS) {
        await this.record('LOGIN_BURST', { ip }, { failures, accounts, minutes: LOGIN_BURST_WINDOW_MINUTES });
      }
    } catch (err) {
      this.logger.error('Не вдалося перевірити серію невдалих входів', err as Error);
    }
  }

  /** After a card was opened: an unusual number within an hour is reported to the administrators. */
  async checkViews(viewer: Pick<AuthUser, 'id' | 'fullName' | 'legalEntityId'>, ip = '') {
    const limit = this.env.massViewPerHour;
    if (!limit) return;
    try {
      const count = await this.audit.countBy({
        userId: viewer.id,
        action: 'VIEW',
        createdAt: MoreThan(new Date(Date.now() - 60 * MINUTE)),
      });
      if (count >= limit) {
        await this.record(
          'MASS_VIEW',
          { userId: viewer.id, userName: viewer.fullName, legalEntityId: viewer.legalEntityId, ip },
          { count, period: 'година' },
        );
      }
    } catch (err) {
      this.logger.error('Не вдалося перевірити кількість переглядів', err as Error);
    }
  }

  /** How many files the account has downloaded in the last hour / day. */
  async exportsSince(userId: string) {
    const now = Date.now();
    const [hour, day] = await Promise.all([
      this.exports.countBy({ userId, createdAt: MoreThan(new Date(now - 60 * MINUTE)) }),
      this.exports.countBy({ userId, createdAt: MoreThan(new Date(now - 24 * 60 * MINUTE)) }),
    ]);
    return { hour, day };
  }

  async recordExport(row: Omit<ExportUsage, 'createdAt'>) {
    return this.exports.save(this.exports.create(row));
  }

  /** Who downloaded a file with this SHA-256 (within the legal entity of the one asking). */
  async trace(sha256: string, scope: Scope): Promise<ExportTrace[]> {
    const rows = await this.exports.find({
      where: { sha256: sha256.toLowerCase(), ...(scope ? { legalEntityId: scope } : {}) },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (!rows.length) return [];
    const names = new Map(
      (await this.users.find({ where: { id: In([...new Set(rows.map((r) => r.userId))]) } })).map((u) => [
        u.id,
        u.fullName,
      ]),
    );
    return rows.map((r) => ({
      userId: r.userId,
      userName: names.get(r.userId) ?? '—',
      fileName: r.fileName,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** The journal: the legal entity's own events (the main administrator — all, including the address-only ones). */
  async list(
    scope: Scope,
    opts: { kind?: SecurityEventKind; page?: number; size?: number },
  ): Promise<SecurityEventsPage> {
    const size = Math.min(Math.max(opts.size ?? SECURITY_PAGE_SIZE, 1), SECURITY_PAGE_MAX);
    const page = Math.max(opts.page ?? 1, 1);
    const [rows, total] = await this.events.findAndCount({
      where: { ...(scope ? { legalEntityId: scope } : {}), ...(opts.kind ? { kind: opts.kind } : {}) },
      order: { createdAt: 'DESC' },
      take: size,
      skip: (page - 1) * size,
    });
    return { items: rows.map(toView), total };
  }

  /** The daily job: old journal rows and download records go. */
  async purge(now = Date.now()) {
    const before = new Date(now - SECURITY_KEEP_DAYS * 24 * 60 * MINUTE);
    const [events, exports] = await Promise.all([
      this.events.delete({ createdAt: LessThan(before) }),
      this.exports.delete({ createdAt: LessThan(before) }),
    ]);
    return { events: events.affected ?? 0, exports: exports.affected ?? 0 };
  }
}

function toView(e: SecurityEvent): SecurityEventView {
  return {
    id: e.id,
    kind: e.kind,
    level: e.level,
    title: SECURITY_TITLES[e.kind],
    userId: e.userId,
    userName: e.userName,
    legalEntityId: e.legalEntityId,
    ip: e.ip,
    device: e.device,
    details: e.details,
    notified: e.notified,
    createdAt: e.createdAt.toISOString(),
  };
}
