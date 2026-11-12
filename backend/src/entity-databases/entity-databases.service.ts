import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isIP } from 'node:net';
import pg from 'pg';
import type { Repository } from 'typeorm';
import { loadEnv } from '../config/env.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type { DatabaseCheckResult, EntityDatabaseView } from '../shared/interfaces/entity-database.interface.js';
import { DB_CONNECT_TIMEOUT_MS, DB_QUERY_TIMEOUT_MS } from './entity-databases.constants.js';
import type { EntityDatabaseDto } from './entity-databases.dto.js';
import { EntityDatabase } from './entity-database.entity.js';
import { resolvePublicHost } from './utils/db-host.utils.js';

/**
 * Stage 1 of the own database of a legal entity: the connection is saved (the password encrypted)
 * and checked — reachable, TLS, may the account create tables. The data still live in the main database.
 */
@Injectable()
export class EntityDatabasesService {
  private readonly env = loadEnv();

  constructor(@InjectRepository(EntityDatabase) private readonly repo: Repository<EntityDatabase>) {}

  private toView(row: EntityDatabase | null): EntityDatabaseView {
    return {
      configured: !!row,
      host: row?.host ?? '',
      port: row?.port ?? 5432,
      database: row?.database ?? '',
      username: row?.username ?? '',
      hasPassword: !!row?.password,
      sslMode: row?.sslMode ?? 'require',
      status: row?.status ?? 'NEW',
      lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
      lastError: row?.lastError ?? '',
      serverVersion: row?.serverVersion ?? '',
      canCreate: row?.canCreate ?? false,
      allowPlainText: this.env.allowPrivateDbHosts,
    };
  }

  async get(legalEntityId: string): Promise<EntityDatabaseView> {
    return this.toView(await this.repo.findOneBy({ legalEntityId }));
  }

  async save(legalEntityId: string, dto: EntityDatabaseDto, by: AuthUser): Promise<EntityDatabaseView> {
    // personal data may not travel in plain text — only in development
    if (dto.sslMode === 'disable' && !this.env.allowPrivateDbHosts) {
      throw new BadRequestException(
        'Підключення без шифрування заборонено: дані працівників мають передаватися через TLS',
      );
    }
    const existing = await this.repo.findOneBy({ legalEntityId });
    const password = dto.password ? dto.password : existing?.password;
    if (!password) throw new BadRequestException('Вкажіть пароль користувача бази даних');
    const row = this.repo.create({
      ...(existing ?? {}),
      legalEntityId,
      host: dto.host.trim(),
      port: dto.port,
      database: dto.database,
      username: dto.username,
      password,
      sslMode: dto.sslMode,
      status: 'NEW',
      lastError: '',
      updatedBy: by.email,
    });
    return this.toView(await this.repo.save(row));
  }

  async remove(legalEntityId: string): Promise<void> {
    await this.repo.delete({ legalEntityId });
  }

  /**
   * Connects to the saved database (to the checked address — see resolvePublicHost) and asks the version
   * and the rights. The result is saved; the error text is shortened and has no password.
   */
  async check(legalEntityId: string): Promise<DatabaseCheckResult> {
    const row = await this.repo.findOneBy({ legalEntityId });
    if (!row) throw new NotFoundException('Спершу збережіть параметри підключення');
    let result: DatabaseCheckResult;
    try {
      const address = await resolvePublicHost(row.host, this.env.allowPrivateDbHosts);
      const client = new pg.Client({
        host: address,
        port: row.port,
        database: row.database,
        user: row.username,
        password: row.password,
        ssl:
          row.sslMode === 'disable'
            ? false
            : {
                rejectUnauthorized: row.sslMode === 'verify-full',
                // the certificate is checked against the name typed, while the connection goes to the checked IP
                ...(isIP(row.host) ? {} : { servername: row.host }),
              },
        connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
        statement_timeout: DB_QUERY_TIMEOUT_MS,
        query_timeout: DB_QUERY_TIMEOUT_MS,
        application_name: 'military-registry-check',
      });
      try {
        await client.connect();
        const { rows } = await client.query<{ version: string; can_create: boolean }>(
          `SELECT current_setting('server_version') AS version,
                  has_database_privilege(current_database(), 'CREATE') AS can_create`,
        );
        const canCreate = !!rows[0]?.can_create;
        result = {
          ok: true,
          serverVersion: `PostgreSQL ${rows[0]?.version ?? ''}`.trim(),
          canCreate,
          message: canCreate
            ? 'Підключення працює, користувач може створювати таблиці.'
            : 'Підключення працює, але користувач не може створювати таблиці (потрібне право CREATE на базу).',
        };
      } finally {
        await client.end().catch(() => undefined);
      }
    } catch (err) {
      result = { ok: false, serverVersion: '', canCreate: false, message: this.reason(err, row.password) };
    }
    row.status = result.ok ? 'OK' : 'ERROR';
    row.lastCheckedAt = new Date();
    row.lastError = result.ok ? '' : result.message;
    row.serverVersion = result.serverVersion;
    row.canCreate = result.canCreate;
    await this.repo.save(row);
    return result;
  }

  /** A readable reason without secrets. */
  private reason(err: unknown, password: string): string {
    const e = err as { code?: string; message?: string };
    const known: Record<string, string> = {
      ENOTFOUND: 'Адресу сервера не знайдено (DNS)',
      ECONNREFUSED: 'Сервер відхилив з’єднання — перевірте порт і чи дозволено підключення ззовні',
      ETIMEDOUT: 'Сервер не відповідає — перевірте адресу, порт і брандмауер',
      '28P01': 'Невірний користувач або пароль',
      '28000': 'Сервер не дозволяє підключення для цього користувача / адреси (pg_hba.conf)',
      '3D000': 'Бази даних з такою назвою немає',
      DEPTH_ZERO_SELF_SIGNED_CERT: 'Сертифікат сервера самопідписаний — оберіть шифрування «require»',
      SELF_SIGNED_CERT_IN_CHAIN: 'Сертифікат сервера самопідписаний — оберіть шифрування «require»',
      ERR_TLS_CERT_ALTNAME_INVALID: 'Сертифікат сервера видано на інше ім’я',
    };
    const text = (e.code && known[e.code]) || e.message || 'Не вдалося підключитися';
    const lower = text.toLowerCase();
    const fixed = lower.includes('timeout') ? 'Сервер не відповідає — перевірте адресу, порт і брандмауер' : text;
    return fixed.split(password).join('***').slice(0, 500);
  }
}
