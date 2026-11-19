import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { blindIndex } from '../common/crypto/field-encryption.js';
import { NIL_UUID } from '../common/constants/common.constants.js';
import { addDays, todayIso } from '../common/utils/dates.utils.js';
import { loadEnv } from '../config/env.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { EmployeesService } from '../employees/employees.service.js';
import type { CreateEmployeeDto, UpdateEmployeeDto } from '../employees/employees.dto.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { toDtoValues } from '../employees/import/utils/import-rows.utils.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { SubscriptionGateService } from '../subscriptions/subscription-gate.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type {
  HrBatchCounts,
  HrBatchItem,
  HrBatchSource,
  HrBatchStatus,
  HrBatchSummary,
  HrBatchView,
  HrODataCheck,
  HrPlannedItem,
  HrPushResult,
  HrRecord,
  HrSyncSettingsView,
} from '../shared/interfaces/hr-sync.interface.js';
import type { ImportValues } from '../shared/interfaces/import.interface.js';
import { HrSyncBatch } from './entities/hr-sync-batch.entity.js';
import { HrSyncSettings } from './entities/hr-sync-settings.entity.js';
import {
  HR_ACTOR_NAME,
  HR_BATCH_KEEP_DAYS,
  HR_HISTORY_ROWS,
  HR_PUSH_PATH,
  HR_SYSTEM_LABELS,
} from './hr-sync.constants.js';
import type { HrSyncSettingsDto } from './hr-sync.dto.js';
import { ODataError, OneCODataClient } from './odata/one-c-odata.client.js';
import { countItems, planBatch, publicItem } from './utils/hr-records.utils.js';
import { issueToken, parseToken, PushFormatError, readPushBody, tokenMatches } from './utils/hr-push.utils.js';

const SETTINGS_NOT_FOUND = 'Інтеграцію з 1С ще не налаштовано';
const BATCH_NOT_FOUND = 'Отримання не знайдено';

/** The hour in Kyiv — the daily OData read runs at the hour chosen in the settings. */
export const kyivHour = (at = new Date()) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', hourCycle: 'h23' }).format(at));

/**
 * Employees from 1C / BAS: 1C sends them (PUSH, a key per legal entity) or we read the published base (OData).
 * Every delivery becomes a batch: the comparison with our cards, applied at once (autoApply) or after a review.
 * Applying goes through the employees service — the same journal and the same TCK queue as by hand.
 */
@Injectable()
export class HrSyncService {
  private readonly env = loadEnv();
  private readonly log = new Logger('HrSync');

  constructor(
    @InjectRepository(HrSyncSettings) private readonly settings: Repository<HrSyncSettings>,
    @InjectRepository(HrSyncBatch) private readonly batches: Repository<HrSyncBatch>,
    @InjectRepository(Employee) private readonly employeesRepo: Repository<Employee>,
    @InjectRepository(Tck) private readonly tcks: Repository<Tck>,
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly employees: EmployeesService,
    private readonly gate: SubscriptionGateService,
  ) {}

  // ───────────── settings ─────────────

  async view(legalEntityId: string): Promise<HrSyncSettingsView> {
    await this.entity(legalEntityId);
    return this.toView(await this.settings.findOneBy({ legalEntityId }));
  }

  async save(legalEntityId: string, dto: HrSyncSettingsDto, by: AuthUser): Promise<HrSyncSettingsView> {
    await this.entity(legalEntityId);
    const existing = await this.settings.findOneBy({ legalEntityId });
    const odataPassword = dto.odataPassword || existing?.odataPassword || '';
    if (dto.mode === 'ODATA') {
      if (dto.system === 'OTHER') throw new BadRequestException('Читання OData — лише для баз 1С / BAS');
      if (!dto.odataUrl?.trim() || !dto.odataUser?.trim() || !odataPassword) {
        throw new BadRequestException('Для читання з 1С вкажіть адресу публікації, користувача і пароль');
      }
      // the address is checked at once (https, not an internal one) — the same rules as when reading
      try {
        new OneCODataClient({
          url: dto.odataUrl,
          user: dto.odataUser,
          password: odataPassword,
          allowPrivate: this.env.allowPrivateDbHosts,
        });
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'Невірна адреса публікації');
      }
    }
    const row = this.settings.create({
      ...(existing ?? {}),
      legalEntityId,
      system: dto.system,
      mode: dto.mode,
      odataUrl: dto.odataUrl?.trim() ?? '',
      odataUser: dto.odataUser?.trim() ?? '',
      odataPassword,
      organizationCode: dto.organizationCode?.trim() ?? '',
      scheduleEnabled: dto.mode === 'ODATA' && dto.scheduleEnabled,
      scheduleHour: dto.scheduleHour,
      autoApply: dto.autoApply,
      militaryPolicy: dto.militaryPolicy,
      importDismissed: dto.importDismissed,
      configuredById: by.id,
      configuredBy: by.fullName,
    });
    return this.toView(await this.settings.save(row));
  }

  /** Switches the integration off: the settings, the key and the history are deleted. */
  async remove(legalEntityId: string): Promise<void> {
    await this.batches.delete({ legalEntityId });
    await this.settings.delete({ legalEntityId });
  }

  /** A new push key (the old one stops working at once). The key is returned once and never again. */
  async issueToken(legalEntityId: string, by: AuthUser): Promise<{ token: string; settings: HrSyncSettingsView }> {
    const row = await this.mustSettings(legalEntityId);
    const { token, prefix, hash } = issueToken();
    Object.assign(row, {
      tokenPrefix: prefix,
      tokenHash: hash,
      tokenIssuedAt: new Date(),
      configuredById: by.id,
      configuredBy: by.fullName,
    });
    return { token, settings: this.toView(await this.settings.save(row)) };
  }

  async revokeToken(legalEntityId: string): Promise<HrSyncSettingsView> {
    const row = await this.mustSettings(legalEntityId);
    Object.assign(row, { tokenPrefix: '', tokenHash: '', tokenIssuedAt: null });
    return this.toView(await this.settings.save(row));
  }

  // ───────────── OData ─────────────

  /** «Перевірити з'єднання»: the tables, the configuration, the organizations and how many employees. */
  async check(legalEntityId: string): Promise<HrODataCheck> {
    const row = await this.mustSettings(legalEntityId);
    const entity = await this.entity(legalEntityId);
    const result: HrODataCheck = { ok: false, message: '', detected: '', organizations: [], employees: 0, missing: [] };
    try {
      const client = this.client(row);
      const profile = await client.profile();
      result.detected = profile.profile.title;
      result.missing = profile.missing;
      result.organizations = (await client.organizations(profile)).map((o) => ({ code: o.code, name: o.name }));
      const records = await client.employees(profile, row.organizationCode || entity.edrpou || '');
      result.employees = records.filter((r) => !r.dismissalDate).length;
      result.ok = true;
      result.message = `З’єднання є. Працюючих працівників: ${result.employees}`;
    } catch (err) {
      result.message = err instanceof ODataError ? err.message : 'Не вдалося прочитати дані з 1С';
      if (!(err instanceof ODataError)) this.log.warn(`check ${legalEntityId}: ${(err as Error).message}`);
    }
    return result;
  }

  /** «Отримати зараз» (and the daily run): reads 1C and makes a batch. */
  async pull(legalEntityId: string, source: HrBatchSource, by?: AuthUser): Promise<HrBatchView> {
    const row = await this.mustSettings(legalEntityId);
    if (row.mode !== 'ODATA') throw new BadRequestException('Читання з 1С не увімкнено — оберіть спосіб «OData»');
    const entity = await this.entity(legalEntityId);
    let records: HrRecord[];
    try {
      const client = this.client(row);
      records = await client.employees(await client.profile(), row.organizationCode || entity.edrpou || '');
    } catch (err) {
      const message = err instanceof ODataError ? err.message : 'Не вдалося прочитати дані з 1С';
      if (!(err instanceof ODataError)) this.log.warn(`pull ${legalEntityId}: ${(err as Error).message}`);
      await this.settings.update(
        { legalEntityId },
        { lastRunAt: new Date(), lastStatus: 'FAILED', lastMessage: message },
      );
      throw new BadRequestException(message);
    }
    if (!records.length) {
      const message = 'У 1С не знайдено працівників цієї організації';
      await this.settings.update(
        { legalEntityId },
        { lastRunAt: new Date(), lastStatus: 'FAILED', lastMessage: message },
      );
      throw new BadRequestException(message);
    }
    return this.receive(row, records, source, by);
  }

  // ───────────── push ─────────────

  /** POST /integrations/1c/employees from the data processor of 1C, with the key of the legal entity. */
  async receivePush(authorization: string | undefined, body: unknown): Promise<HrPushResult> {
    const row = await this.byKey(authorization);
    let records: HrRecord[];
    try {
      records = readPushBody(body);
    } catch (err) {
      if (err instanceof PushFormatError) throw new BadRequestException(err.message);
      throw err;
    }
    const batch = await this.receive(row, records, 'PUSH');
    return { batchId: batch.id, received: records.length, status: batch.status, counts: batch.counts };
  }

  /** The check of the key from 1C: whose it is (the name and the code — so the administrator sees he got the right one). */
  async ping(authorization: string | undefined): Promise<{ ok: true; legalEntity: string; edrpou: string }> {
    const row = await this.byKey(authorization);
    const entity = await this.entity(row.legalEntityId);
    return { ok: true, legalEntity: entity.shortName || entity.fullName, edrpou: entity.edrpou };
  }

  private async byKey(authorization: string | undefined): Promise<HrSyncSettings> {
    const parsed = parseToken(authorization);
    const row = parsed ? await this.settings.findOneBy({ tokenPrefix: parsed.prefix }) : null;
    if (!parsed || !row || !tokenMatches(parsed.secret, row.tokenHash)) {
      throw new UnauthorizedException('Невірний або відкликаний ключ інтеграції');
    }
    if (row.mode !== 'PUSH') {
      throw new ForbiddenException('Для цієї юрособи прийом даних з 1С вимкнено (обрано інший спосіб)');
    }
    if ((await this.gate.gate(row.legalEntityId)) !== 'OK') {
      throw new ForbiddenException('Підписка юрособи неактивна — дані не прийнято');
    }
    return row;
  }

  // ───────────── batches ─────────────

  async history(legalEntityId: string): Promise<HrBatchSummary[]> {
    const rows = await this.batches.find({
      where: { legalEntityId },
      order: { receivedAt: 'DESC' },
      take: HR_HISTORY_ROWS,
      select: {
        id: true,
        legalEntityId: true,
        source: true,
        system: true,
        status: true,
        counts: true,
        message: true,
        receivedAt: true,
        appliedAt: true,
        appliedBy: true,
      },
    });
    return rows.map((b) => this.summary(b));
  }

  async batch(legalEntityId: string, id: string): Promise<HrBatchView> {
    return this.toBatchView(await this.mustBatch(legalEntityId, id));
  }

  /** Applies a batch waiting for the review — compared again with the cards as they are now. */
  async apply(legalEntityId: string, id: string, by: AuthUser): Promise<HrBatchView> {
    const batch = await this.mustBatch(legalEntityId, id);
    const row = await this.mustSettings(legalEntityId);
    return this.applyBatch(batch, row, by);
  }

  async discard(legalEntityId: string, id: string, by: AuthUser): Promise<HrBatchView> {
    const batch = await this.mustBatch(legalEntityId, id);
    const { affected } = await this.batches.update(
      { id, status: 'PENDING' },
      { status: 'DISCARDED', appliedAt: new Date(), appliedBy: by.fullName },
    );
    if (!affected) throw new ConflictException('Це отримання вже оброблено');
    return this.toBatchView({ ...batch, status: 'DISCARDED', appliedAt: new Date(), appliedBy: by.fullName });
  }

  // ───────────── jobs ─────────────

  /**
   * The scheduled OData reads. With `hour` — the legal entities whose hour it is (hourly job);
   * without — those not read for more than a day (a safety net in the daily job).
   */
  async runScheduled(hour?: number): Promise<{ read: number; failed: number }> {
    const rows = await this.settings.find({ where: { mode: 'ODATA', scheduleEnabled: true } });
    const dayAgo = Date.now() - 26 * 3600_000;
    let read = 0;
    let failed = 0;
    for (const row of rows) {
      if (hour !== undefined ? row.scheduleHour !== hour : (row.lastRunAt?.getTime() ?? 0) > dayAgo) continue;
      if ((await this.gate.gate(row.legalEntityId)) !== 'OK') continue;
      try {
        await this.pull(row.legalEntityId, 'ODATA_SCHEDULE');
        read++;
      } catch (err) {
        failed++;
        this.log.warn(`scheduled ${row.legalEntityId}: ${(err as Error).message}`);
      }
    }
    return { read, failed };
  }

  /** Deliveries older than HR_BATCH_KEEP_DAYS days are deleted (personal data are not kept longer than needed). */
  async purge(): Promise<number> {
    const before = new Date(`${addDays(todayIso(), -HR_BATCH_KEEP_DAYS)}T00:00:00Z`);
    const { affected } = await this.batches.delete({ receivedAt: LessThan(before) });
    return affected ?? 0;
  }

  // ───────────── internals ─────────────

  /** Makes a batch of the records and, with autoApply, applies it at once. */
  private async receive(
    row: HrSyncSettings,
    records: HrRecord[],
    source: HrBatchSource,
    by?: AuthUser,
  ): Promise<HrBatchView> {
    const items = await this.plan(row, records);
    const counts = countItems(items);
    const batch = await this.batches.save(
      this.batches.create({
        legalEntityId: row.legalEntityId,
        source,
        system: row.system,
        status: 'PENDING',
        payload: JSON.stringify(records),
        items: JSON.stringify(items.map(publicItem)),
        counts,
        message: '',
      }),
    );
    const work = counts.create + counts.update + counts.dismiss;
    if (row.autoApply && work > 0) return this.applyBatch(batch, row, by ?? this.actor(row));
    if (work === 0) {
      // nothing to do — closed at once, but kept in the history
      batch.status = 'APPLIED';
      batch.appliedAt = new Date();
      batch.appliedBy = by?.fullName ?? HR_ACTOR_NAME;
      batch.message = 'Змін немає';
      // an unchanged card that has no link to 1C yet gets it silently
      await this.linkOnly(items);
      await this.batches.save(batch);
    }
    await this.remember(row.legalEntityId, batch.status, this.describe(counts, batch.status));
    return this.toBatchView(batch);
  }

  private async applyBatch(batch: HrSyncBatch, row: HrSyncSettings, by: AuthUser): Promise<HrBatchView> {
    // the status is the lock: only one apply of a batch, even with two clicks or two instances
    const { affected } = await this.batches.update({ id: batch.id, status: 'PENDING' }, { status: 'APPLIED' });
    if (!affected) throw new ConflictException('Це отримання вже оброблено');

    const records = JSON.parse(batch.payload) as HrRecord[];
    const items = await this.plan(row, records);
    let ok = 0;
    let failed = 0;
    for (const item of items) {
      if (item.action === 'CREATE' && item.create) {
        try {
          const dto = { ...toDtoValues(item.create as ImportValues), legalEntityId: row.legalEntityId };
          const { ids } = await this.employees.createMany([dto as unknown as CreateEmployeeDto], by, {
            hireNotices: 'RECENT',
            source: 'інтеграція з 1С',
          });
          item.employeeId = ids[0] ?? null;
          item.result = 'OK';
          ok++;
        } catch (err) {
          item.result = 'FAILED';
          item.messages.push(this.reason(err));
          failed++;
        }
      } else if ((item.action === 'UPDATE' || item.action === 'DISMISS') && item.update && item.employeeId) {
        try {
          await this.employees.update(item.employeeId, item.update as unknown as UpdateEmployeeDto, by);
          item.result = 'OK';
          ok++;
        } catch (err) {
          item.result = 'FAILED';
          item.messages.push(this.reason(err));
          failed++;
        }
      }
    }
    await this.linkOnly(items);

    const status: HrBatchStatus = failed === 0 ? 'APPLIED' : ok === 0 ? 'FAILED' : 'PARTIAL';
    const counts = countItems(items);
    batch.status = status;
    batch.items = JSON.stringify(items.map(publicItem));
    batch.counts = counts;
    batch.appliedAt = new Date();
    batch.appliedBy = by.fullName;
    batch.message = this.describe(counts, status, failed);
    await this.batches.save(batch);
    await this.remember(row.legalEntityId, status, batch.message);
    return this.toBatchView(batch);
  }

  /** «UNCHANGED» cards that only get the link to 1C — written directly, not a change of the card. */
  private async linkOnly(items: HrPlannedItem[]) {
    for (const item of items) {
      const externalId = item.update?.externalId;
      if (item.action === 'UNCHANGED' && item.employeeId && typeof externalId === 'string') {
        await this.employeesRepo.update({ id: item.employeeId }, { externalId });
      }
    }
  }

  private async plan(row: HrSyncSettings, records: HrRecord[]): Promise<HrPlannedItem[]> {
    const [employees, tcks] = await Promise.all([
      this.employeesRepo.find({ where: { legalEntityId: row.legalEntityId } }),
      this.tcks.find({ select: { id: true, name: true } }),
    ]);
    return planBatch(records, {
      employees,
      tcks,
      hash: (rnokpp) => blindIndex(rnokpp),
      militaryPolicy: row.militaryPolicy,
      importDismissed: row.importDismissed,
      today: todayIso(),
    });
  }

  private client(row: HrSyncSettings) {
    if (!row.odataUrl || !row.odataUser || !row.odataPassword) {
      throw new ODataError('Вкажіть адресу публікації 1С, користувача і пароль');
    }
    return new OneCODataClient({
      url: row.odataUrl,
      user: row.odataUser,
      password: row.odataPassword,
      allowPrivate: this.env.allowPrivateDbHosts,
    });
  }

  /** Who the automatic changes are signed by in the card journal and the TCK queue. */
  private actor(row: HrSyncSettings): AuthUser {
    return {
      id: row.configuredById ?? NIL_UUID,
      email: '',
      fullName: HR_ACTOR_NAME,
      role: 'HR',
      legalEntityId: row.legalEntityId,
      mustChangePassword: false,
    };
  }

  private reason(err: unknown): string {
    const res = (err as { getResponse?: () => unknown }).getResponse?.();
    const message = (res as { message?: unknown } | undefined)?.message ?? (err as Error).message;
    const text = Array.isArray(message) ? message.join('; ') : typeof message === 'string' ? message : '';
    return `Не застосовано: ${text.slice(0, 200) || 'помилка'}`;
  }

  private describe(c: HrBatchCounts, status: HrBatchStatus, failed = 0) {
    const parts = [
      c.create && `нових ${c.create}`,
      c.update && `змінено ${c.update}`,
      c.dismiss && `звільнено ${c.dismiss}`,
      c.conflict && `розбіжностей ${c.conflict}`,
      c.error && `з помилками ${c.error}`,
      failed && `не вдалося ${failed}`,
    ].filter(Boolean);
    const head = status === 'PENDING' ? 'Чекає на перегляд' : status === 'FAILED' ? 'Не застосовано' : 'Отримано';
    return `${head}: ${parts.length ? parts.join(', ') : 'змін немає'} (усього ${c.total})`;
  }

  private remember(legalEntityId: string, status: HrBatchStatus, message: string) {
    return this.settings.update(
      { legalEntityId },
      { lastRunAt: new Date(), lastStatus: status, lastMessage: message.slice(0, 500) },
    );
  }

  private async entity(id: string): Promise<LegalEntity> {
    const entity = await this.entities.findOneBy({ id });
    if (!entity) throw new NotFoundException('Юрособу не знайдено');
    return entity;
  }

  private async mustSettings(legalEntityId: string): Promise<HrSyncSettings> {
    const row = await this.settings.findOneBy({ legalEntityId });
    if (!row) throw new NotFoundException(SETTINGS_NOT_FOUND);
    return row;
  }

  private async mustBatch(legalEntityId: string, id: string): Promise<HrSyncBatch> {
    const batch = await this.batches.findOneBy({ id, legalEntityId });
    if (!batch) throw new NotFoundException(BATCH_NOT_FOUND);
    return batch;
  }

  private summary(b: HrSyncBatch): HrBatchSummary {
    return {
      id: b.id,
      source: b.source,
      status: b.status,
      system: b.system,
      receivedAt: b.receivedAt.toISOString(),
      appliedAt: b.appliedAt?.toISOString() ?? null,
      appliedBy: b.appliedBy,
      counts: b.counts,
      message: b.message,
    };
  }

  private toBatchView(b: HrSyncBatch): HrBatchView {
    return { ...this.summary(b), items: JSON.parse(b.items) as HrBatchItem[] };
  }

  private toView(row: HrSyncSettings | null): HrSyncSettingsView {
    return {
      configured: !!row,
      system: row?.system ?? 'ZUP',
      mode: row?.mode ?? 'PUSH',
      odataUrl: row?.odataUrl ?? '',
      odataUser: row?.odataUser ?? '',
      hasOdataPassword: !!row?.odataPassword,
      organizationCode: row?.organizationCode ?? '',
      scheduleEnabled: row?.scheduleEnabled ?? false,
      scheduleHour: row?.scheduleHour ?? 6,
      autoApply: row?.autoApply ?? true,
      militaryPolicy: row?.militaryPolicy ?? 'FILL_EMPTY',
      importDismissed: row?.importDismissed ?? false,
      tokenPrefix: row?.tokenPrefix ?? '',
      tokenIssuedAt: row?.tokenIssuedAt?.toISOString() ?? null,
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
      lastStatus: row?.lastStatus ?? null,
      lastMessage: row?.lastMessage ?? '',
      pushUrl: HR_PUSH_PATH,
      allowPrivateHosts: this.env.allowPrivateDbHosts,
    };
  }

  /** For the audit journal: «1С / BAS: ЗУП, OData». */
  label(view: Pick<HrSyncSettingsView, 'system' | 'mode'>): string {
    return `${HR_SYSTEM_LABELS[view.system]}, ${view.mode === 'PUSH' ? 'надсилання з 1С' : view.mode === 'ODATA' ? 'читання OData' : 'файл'}`;
  }
}
