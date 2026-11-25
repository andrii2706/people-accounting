import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addDays, todayIso } from '../common/utils/dates.utils.js';
import { loadEnv } from '../config/env.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { QuotaRecalculation } from '../legal-entities/quota-recalculation.entity.js';
import { entityQuota, quotaStanding } from '../legal-entities/utils/quota.utils.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type {
  EntityQuota,
  QuotaLetterInput,
  QuotaNotifySettings,
  QuotaPage,
  QuotaRecalculationView,
} from '../shared/interfaces/legal-entity.interface.js';
import { NotificationsService } from './notifications.service.js';
import { QUOTA_EXPIRING_DAYS, QUOTA_HISTORY_LIMIT } from './notifications.constants.js';
import { quotaLetter } from './templates/quota-letter.template.js';

/**
 * The reservation quota of a legal entity is recalculated after every change that may move it (hiring, dismissal,
 * reservation, the percent) and once a day. A recalculation that changed the numbers is written down; an exceeded
 * quota, fewer free places and the end of the decision are e-mailed (numbers only, no names).
 */
@Injectable()
export class QuotaWatchService {
  private readonly logger = new Logger(QuotaWatchService.name);
  private readonly env = loadEnv();

  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    @InjectRepository(QuotaRecalculation) private readonly recalcs: Repository<QuotaRecalculation>,
    private readonly notifications: NotificationsService,
  ) {}

  /** The quota of the legal entity now. */
  async current(entity: LegalEntity, date: IsoDate = todayIso()): Promise<EntityQuota> {
    const staff = await this.employees.find({ where: { legalEntityId: entity.id }, loadEagerRelations: false });
    return entityQuota(
      entity,
      staff.map((e) => quotaStanding(e, date)),
      date,
    );
  }

  /**
   * Recalculates the quota of the legal entities (null / duplicates are skipped). Never throws — a failed
   * recalculation must not break saving the card.
   */
  async recalc(entityIds: (string | null | undefined)[], reason: string, date: IsoDate = todayIso()): Promise<void> {
    for (const id of new Set(entityIds.filter((x): x is string => !!x))) {
      try {
        await this.recalcOne(id, reason, date);
      } catch (err) {
        this.logger.error(`Квоту юрособи ${id} не перераховано`, err as Error);
      }
    }
  }

  /** The daily run: every legal entity (terms end, the decision ends) + the reminder about the decision. */
  async daily(today: IsoDate = todayIso()) {
    const all = await this.entities.find();
    await this.recalc(
      all.map((e) => e.id),
      'Щоденна перевірка',
      today,
    );
    let expiring = 0;
    for (const e of all) {
      const until = e.reservationQuotaValidUntil;
      if (!e.quotaNotifyExpiring || !until || until < today || until > addDays(today, QUOTA_EXPIRING_DAYS)) continue;
      if (await this.notifications.wasSent('QUOTA_EXPIRING', e.id, until)) continue;
      const q = await this.current(e, today);
      const sent = await this.notifications.notifyUsersLetter(
        quotaLetter(this.letterInput('EXPIRING', e, q, null, '')),
        e.id,
      );
      await this.notifications.markSent('QUOTA_EXPIRING', [{ refId: e.id, refDate: until }], sent);
      expiring++;
    }
    return { entities: all.length, expiring };
  }

  async page(entityId: string): Promise<QuotaPage> {
    const entity = await this.entities.findOneByOrFail({ id: entityId });
    const [quota, rows, recipients] = await Promise.all([
      this.current(entity),
      this.recalcs.find({
        where: { legalEntityId: entityId },
        order: { createdAt: 'DESC' },
        take: QUOTA_HISTORY_LIMIT,
      }),
      this.notifications.recipients(entityId),
    ]);
    const extraEmails = entity.notifyEmails
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    return {
      quota,
      docName: entity.reservationQuotaDocName,
      docDate: entity.reservationQuotaDocDate,
      docNumber: entity.reservationQuotaDocNumber,
      recalculations: rows.map((r): QuotaRecalculationView => ({
        id: r.id,
        createdAt: r.createdAt,
        reason: r.reason,
        base: r.base,
        prevBase: r.prevBase,
        quota: r.quota,
        prevQuota: r.prevQuota,
        reservedCompany: r.reservedCompany,
        prevReserved: r.prevReserved,
        available: r.available,
        exceeded: r.exceeded,
      })),
      notify: this.settings(entity),
      recipients: recipients.length,
      extraEmails,
      mailConfigured: this.notifications.mailConfigured,
    };
  }

  async saveSettings(entityId: string, dto: Partial<QuotaNotifySettings>): Promise<QuotaNotifySettings> {
    const entity = await this.entities.findOneByOrFail({ id: entityId });
    if (dto.exceeded !== undefined) entity.quotaNotifyExceeded = dto.exceeded;
    if (dto.decreased !== undefined) entity.quotaNotifyDecreased = dto.decreased;
    if (dto.expiring !== undefined) entity.quotaNotifyExpiring = dto.expiring;
    await this.entities.save(entity);
    return this.settings(entity);
  }

  private settings(e: LegalEntity): QuotaNotifySettings {
    return { exceeded: e.quotaNotifyExceeded, decreased: e.quotaNotifyDecreased, expiring: e.quotaNotifyExpiring };
  }

  private async recalcOne(entityId: string, reason: string, date: IsoDate) {
    const entity = await this.entities.findOneBy({ id: entityId });
    if (!entity) return;
    const q = await this.current(entity, date);
    const last = await this.recalcs.findOne({ where: { legalEntityId: entityId }, order: { createdAt: 'DESC' } });
    const same = !!last && last.base === q.base && last.quota === q.quota && last.reservedCompany === q.reservedCompany;
    if (!same) {
      await this.recalcs.save(
        this.recalcs.create({
          legalEntityId: entityId,
          reason: reason.slice(0, 300),
          percent: q.percent,
          base: q.base,
          quota: q.quota,
          reservedCompany: q.reservedCompany,
          available: q.available,
          exceeded: q.exceeded,
          prevBase: last?.base ?? null,
          prevQuota: last?.quota ?? null,
          prevReserved: last?.reservedCompany ?? null,
        }),
      );
    }
    await this.mailIfNeeded(entity, q, last ?? null, reason);
  }

  /**
   * Exceeded: once, and again only when the exceeding grew (back to normal resets it).
   * Fewer free places than at the previous recalculation (and not exceeded): once per such recalculation.
   */
  private async mailIfNeeded(entity: LegalEntity, q: EntityQuota, last: QuotaRecalculation | null, reason: string) {
    const over = q.exceeded && q.quota !== null ? q.reservedCompany - q.quota : 0;
    if (over > 0) {
      if (entity.quotaExceededNotified === null || over > entity.quotaExceededNotified) {
        if (entity.quotaNotifyExceeded) {
          await this.notifications.notifyUsersLetter(
            quotaLetter(this.letterInput('EXCEEDED', entity, q, last, reason)),
            entity.id,
          );
        }
        await this.entities.update(entity.id, { quotaExceededNotified: over });
      }
      return;
    }
    if (entity.quotaExceededNotified !== null) await this.entities.update(entity.id, { quotaExceededNotified: null });
    const before = last?.available ?? null;
    if (
      entity.quotaNotifyDecreased &&
      last &&
      before !== null &&
      q.available !== null &&
      q.available < before &&
      !(last.base === q.base && last.quota === q.quota && last.reservedCompany === q.reservedCompany)
    ) {
      await this.notifications.notifyUsersLetter(
        quotaLetter(this.letterInput('DECREASED', entity, q, last, reason)),
        entity.id,
      );
    }
  }

  private letterInput(
    kind: QuotaLetterInput['kind'],
    e: LegalEntity,
    q: EntityQuota,
    last: QuotaRecalculation | null,
    reason: string,
  ): QuotaLetterInput {
    return {
      kind,
      entityName: e.shortName || e.fullName,
      entityCode: e.edrpou,
      // the reason may carry a name («Звільнено: …») — the e-mail gets only the kind of event
      reason: reason.split(':')[0],
      percent: q.percent,
      base: q.base,
      prevBase: last?.base ?? null,
      quota: q.quota,
      reservedCompany: q.reservedCompany,
      available: q.available,
      prevAvailable: last?.available ?? null,
      validUntil: q.validUntil,
      url: `${this.env.appUrl}/settings/legal-entities/${e.id}/quota`,
    };
  }
}
