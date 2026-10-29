import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addDays, formatUa, type IsoDate, todayIso } from '../common/utils/dates.js';
import { loadEnv } from '../config/env.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { Organization } from '../organization/organization.entity.js';
import { htmlToText, parseMobilizationTerm } from './decree-parser.js';
import { NIL_REF, NotificationsService } from './notifications.service.js';

/** How many days before the end of a deferral / reservation the reminder is sent. */
export const REMIND_DAYS_BEFORE = 5;
/** Remind to check the decrees this many days before the mobilization term ends. */
const MOBILIZATION_REMIND_DAYS = 14;

const fullName = (e: Employee) => `${e.lastName} ${e.firstName} ${e.middleName}`.trim();

/**
 * Runs once a day (Cloud Scheduler → Cloud Run Job «military-registry-daily»):
 *  1) reads the term of general mobilization from the presidential decrees;
 *  2) e-mails a reminder 5 days before a deferral ends (incl. «до завершення мобілізації»);
 *  3) the same for reservations.
 * Every reminder is sent once (notification_log).
 */
@Injectable()
export class DailyJobService {
  private readonly logger = new Logger(DailyJobService.name);
  private readonly env = loadEnv();

  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    private readonly notifications: NotificationsService,
  ) {}

  async run(today: IsoDate = todayIso()) {
    const mobilization = await this.updateMobilization();
    const org = await this.org();
    return {
      mobilization,
      mobilizationEnding: await this.mobilizationEndingReminder(org, today),
      deferrals: await this.deferralReminders(org, today),
      reservations: await this.reservationReminders(today),
    };
  }

  private async org() {
    return (await this.orgRepo.findOneBy({ id: 1 })) ?? this.orgRepo.create({ id: 1 });
  }

  /** Reads the latest extension of general mobilization; a newer term is saved and announced. */
  async updateMobilization() {
    const org = await this.org();
    const source = this.env.decreeSourceUrl;
    try {
      const res = await fetch(source, {
        headers: { 'User-Agent': 'military-registry/1.0 (mobilization term check)', Accept: 'text/html' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const term = parseMobilizationTerm(htmlToText(await res.text()));
      org.mobilizationCheckedAt = new Date();
      if (!term) {
        await this.orgRepo.save(org);
        this.logger.warn(`У ${source} не знайдено строку мобілізації`);
        return { ok: false, message: 'Строк мобілізації в тексті не знайдено' };
      }
      const changed = !org.mobilizationUntil || term.until > org.mobilizationUntil;
      if (changed) {
        org.mobilizationUntil = term.until;
        org.mobilizationDecree = `Указ Президента України ${term.decree}`.trim();
        org.mobilizationSource = source;
      }
      await this.orgRepo.save(org);
      if (changed) {
        await this.notifications.notifyUsers(
          `Мобілізацію продовжено до ${formatUa(term.until)}`,
          `Строк проведення загальної мобілізації продовжено з ${formatUa(term.from)} на ${term.days} діб — до ${formatUa(term.until)}` +
            `${term.decree ? ` (${org.mobilizationDecree})` : ''}.\n` +
            'Відстрочки «до завершення мобілізації» діють до цієї дати.',
        );
      }
      return { ok: true, until: term.until, decree: org.mobilizationDecree, changed };
    } catch (err) {
      this.logger.error(`Не вдалося перевірити укази (${source})`, err as Error);
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      const reason = err instanceof Error && err.name === 'TimeoutError' ? 'сайт не відповідає' : cause ? `сайт недоступний (${cause})` : (err as Error).message;
      return { ok: false, message: `Не вдалося перевірити укази: ${reason}. Вкажіть строк вручну або спробуйте пізніше.` };
    }
  }

  /** If the term is about to end and no new decree has been found — remind to check it. */
  private async mobilizationEndingReminder(org: Organization, today: IsoDate) {
    const until = org.mobilizationUntil;
    if (!until || until < today || until > addDays(today, MOBILIZATION_REMIND_DAYS)) return 0;
    if (await this.notifications.wasSent('MOBILIZATION_ENDING', NIL_REF, until)) return 0;
    const sent = await this.notifications.notifyUsers(
      `Строк мобілізації спливає ${formatUa(until)}`,
      `За останнім відомим указом загальна мобілізація триває до ${formatUa(until)}. Новий указ про продовження поки не знайдено — ` +
        'система перевіряє щодня. Після продовження строки відстрочок «до завершення мобілізації» оновляться автоматично.',
    );
    await this.notifications.markSent('MOBILIZATION_ENDING', [{ refId: NIL_REF, refDate: until }], sent);
    return sent;
  }

  /** Deferrals that end in ≤ 5 days — one digest letter, each person once per end date. */
  private async deferralReminders(org: Organization, today: IsoDate) {
    const limit = addDays(today, REMIND_DAYS_BEFORE);
    const due: { e: Employee; end: IsoDate }[] = [];
    for (const e of await this.activeEmployees(today)) {
      const end = e.deferralUntilMobilizationEnd ? org.mobilizationUntil : e.deferralUntil;
      if (!end || end < today || end > limit) continue;
      if (await this.notifications.wasSent('DEFERRAL_ENDING', e.id, end)) continue;
      due.push({ e, end });
    }
    if (!due.length) return 0;
    const lines = due.map(({ e, end }) =>
      `• ${fullName(e)} — відстрочка до ${formatUa(end)}${e.deferralUntilMobilizationEnd ? ' (до завершення мобілізації)' : ''}` +
        `${e.deferralMobilizationBasis || e.deferralConscriptionBasis ? `, підстава: ${e.deferralMobilizationBasis || e.deferralConscriptionBasis}` : ''}\n  ${this.env.appUrl}/employees/${e.id}`,
    );
    const sent = await this.notifications.notifyUsers(
      `Закінчується відстрочка: ${due.length} працівн.`,
      `Через ${REMIND_DAYS_BEFORE} днів або раніше закінчується відстрочка:\n\n${lines.join('\n')}\n\n` +
        'Перевірте, чи продовжено відстрочку (Резерв+ / ТЦК), і оновіть дані в картці працівника.',
    );
    await this.notifications.markSent('DEFERRAL_ENDING', due.map(({ e, end }) => ({ refId: e.id, refDate: end })), sent);
    return due.length;
  }

  private async reservationReminders(today: IsoDate) {
    const limit = addDays(today, REMIND_DAYS_BEFORE);
    const due: Employee[] = [];
    for (const e of await this.activeEmployees(today)) {
      if (!e.reserved || !e.reservationUntil || e.reservationUntil < today || e.reservationUntil > limit) continue;
      if (await this.notifications.wasSent('RESERVATION_ENDING', e.id, e.reservationUntil)) continue;
      due.push(e);
    }
    if (!due.length) return 0;
    const sent = await this.notifications.notifyUsers(
      `Закінчується бронювання: ${due.length} працівн.`,
      `Через ${REMIND_DAYS_BEFORE} днів або раніше закінчується бронювання:\n\n` +
        due.map((e) => `• ${fullName(e)} — заброньовано до ${formatUa(e.reservationUntil!)}\n  ${this.env.appUrl}/employees/${e.id}`).join('\n'),
    );
    await this.notifications.markSent('RESERVATION_ENDING', due.map((e) => ({ refId: e.id, refDate: e.reservationUntil! })), sent);
    return due.length;
  }

  private async activeEmployees(today: IsoDate) {
    const all = await this.employees.find({ loadEagerRelations: false });
    return all.filter((e) => !e.dismissalDate || e.dismissalDate > today);
  }
}
