import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { passwordExpiresAt } from '../common/utils/password-policy.utils.js';
import { addDays, formatUa, todayIso } from '../common/utils/dates.utils.js';
import { loadEnv } from '../config/env.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { Organization } from '../organization/organization.entity.js';
import { htmlToText, parseMobilizationTerm } from './utils/decree-parser.utils.js';
import {
  decreeLabel,
  decreeListUrl,
  decreeSearchWindow,
  isMobilizationExtension,
  parseDecreeList,
} from './utils/president-decrees.utils.js';
import { applyMobilizationCheck } from './utils/mobilization-term.utils.js';
import type { MobilizationTerm } from '../shared/interfaces/document.interface.js';
import { NotificationsService } from './notifications.service.js';
import type { ErrorWithCause, IsoDate } from '../shared/interfaces/common.interface.js';
import type { DueDeferral } from '../shared/interfaces/employee.interface.js';
import {
  DECREE_FETCH_TIMEOUT_MS,
  DECREE_LIST_MAX_PAGES,
  DECREE_USER_AGENT,
  MOBILIZATION_ESTIMATED_NOTE,
  MOBILIZATION_EXTENSION_DAYS,
  MOBILIZATION_REMIND_DAYS,
} from './notifications.constants.js';
import { NIL_UUID } from '../common/constants/common.constants.js';
import { PASSWORD_REMINDER_LINK_HOURS, REMIND_DAYS_BEFORE } from './notifications.constants.js';
import { employeeFullName } from '../employees/utils/employee-text.utils.js';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import { groupByEntity } from './utils/group-by-entity.utils.js';
import { QuotaWatchService } from './quota-watch.service.js';

/**
 * Runs once a day (Cloud Scheduler → Cloud Run Job «military-registry-daily»):
 *  1) reads the term of general mobilization from the presidential decrees;
 *  2) e-mails a reminder 5 days before a deferral ends (incl. «до завершення мобілізації»);
 *  3) the same for reservations;
 *  4) recalculates the reservation quota of every legal entity (+ the e-mail before its decision ends).
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
    private readonly legalEntities: LegalEntitiesService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    @Optional() private readonly quota?: QuotaWatchService,
  ) {}

  async run(today: IsoDate = todayIso()) {
    const mobilization = await this.updateMobilization(today);
    const org = await this.org();
    return {
      mobilization,
      mobilizationEnding: await this.mobilizationEndingReminder(org, today),
      deferrals: await this.deferralReminders(org, today),
      reservations: await this.reservationReminders(today),
      passwords: await this.passwordReminders(),
      quota: (await this.quota?.daily(today)) ?? null,
    };
  }

  private async org() {
    return (await this.orgRepo.findOneBy({ id: 1 })) ?? this.orgRepo.create({ id: 1 });
  }

  /**
   * Reads the latest extension of general mobilization; a newer term is saved and announced. When the term has
   * passed and no new decree is known (or the site is down), it is extended by 90 days, marked «очікується указ».
   */
  async updateMobilization(today: IsoDate = todayIso()) {
    const org = await this.org();
    let source = this.env.decreeSourceUrl;
    let term: MobilizationTerm | null = null;
    let failure: string | null = null;
    try {
      term = parseMobilizationTerm(htmlToText(await this.fetchHtml(source)));
      org.mobilizationCheckedAt = new Date();
      if (!term) {
        this.logger.warn(`У ${source} не знайдено строку мобілізації`);
        failure = 'Строк мобілізації в тексті не знайдено';
      }
    } catch (err) {
      this.logger.error(`Не вдалося перевірити укази (${source})`, err as Error);
      failure = `Не вдалося перевірити укази: ${this.reason(err)}. Вкажіть строк вручну або спробуйте пізніше.`;
    }

    // zakon.rada.gov.ua is not always reachable from the cloud — then the list of decrees on president.gov.ua
    if (!term && this.env.decreeFallbackUrl) {
      try {
        const found = await this.termFromPresident(org.mobilizationUntil, today);
        if (found) {
          term = found.term;
          source = found.source;
          failure = null;
          org.mobilizationCheckedAt = new Date();
          this.logger.log(`Строк мобілізації взято з ${source}`);
        }
      } catch (err) {
        this.logger.error(`Не вдалося перевірити укази (${this.env.decreeFallbackUrl})`, err as Error);
      }
    }

    const { state, event } = applyMobilizationCheck(
      {
        until: org.mobilizationUntil,
        confirmedUntil: org.mobilizationConfirmedUntil,
        decree: org.mobilizationDecree,
        estimated: org.mobilizationEstimated,
      },
      term,
      today,
    );
    org.mobilizationUntil = state.until;
    org.mobilizationConfirmedUntil = state.confirmedUntil;
    org.mobilizationDecree = state.decree;
    org.mobilizationEstimated = state.estimated;
    if (event === 'decree' || event === 'confirmed') org.mobilizationSource = source;
    await this.orgRepo.save(org);

    if (event && state.until) {
      const until = formatUa(state.until);
      if (event === 'estimated') {
        await this.notifications.notifyUsers(
          `Мобілізацію продовжено до ${until} (очікується указ)`,
          `Строк загальної мобілізації минув, а нового указу ще не знайдено. Як і кожне продовження досі, строк ` +
            `подовжено на ${MOBILIZATION_EXTENSION_DAYS} діб — до ${until}, з позначкою «${MOBILIZATION_ESTIMATED_NOTE}».\n` +
            'Коли указ з’явиться, дату буде уточнено автоматично. Відстрочки «до завершення мобілізації» діють до цієї дати.',
        );
      } else {
        await this.notifications.notifyUsers(
          event === 'confirmed'
            ? `Указ підтвердив строк мобілізації до ${until}`
            : `Мобілізацію продовжено до ${until}`,
          `Строк проведення загальної мобілізації продовжено${term ? ` з ${formatUa(term.from)} на ${term.days} діб` : ''} — до ${until}` +
            `${state.decree ? ` (${state.decree})` : ''}.\n` +
            'Відстрочки «до завершення мобілізації» діють до цієї дати.',
        );
      }
    }
    const changed = event !== null;
    if (failure) return { ok: false, message: failure, until: state.until, estimated: state.estimated, changed };
    return { ok: true, until: state.until, decree: state.decree, estimated: state.estimated, changed };
  }

  /**
   * The newest decree «Про продовження строку проведення загальної мобілізації» in the list on president.gov.ua
   * (newest first, filtered by dates) → its text → the term. Null — no such decree in the window.
   */
  private async termFromPresident(
    until: IsoDate | null,
    today: IsoDate,
  ): Promise<{ term: MobilizationTerm; source: string } | null> {
    const base = this.env.decreeFallbackUrl;
    const window = decreeSearchWindow(until, today);
    for (let page = 1; page <= DECREE_LIST_MAX_PAGES; page++) {
      const items = parseDecreeList(await this.fetchHtml(decreeListUrl(base, window.from, window.to, page)), base);
      if (!items.length) return null;
      const decree = items.find(isMobilizationExtension);
      if (!decree) continue;
      const parsed = parseMobilizationTerm(htmlToText(await this.fetchHtml(decree.url)));
      if (!parsed) {
        this.logger.warn(`У ${decree.url} не знайдено строку мобілізації`);
        return null;
      }
      return { term: { ...parsed, decree: parsed.decree || decreeLabel(decree) }, source: decree.url };
    }
    return null;
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': DECREE_USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(DECREE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  /** A fetch error in plain words: «сайт не відповідає» / «сайт недоступний (UND_ERR_CONNECT_TIMEOUT)». */
  private reason(err: unknown): string {
    const cause = (err as ErrorWithCause).cause?.code;
    if (err instanceof Error && err.name === 'TimeoutError') return 'сайт не відповідає';
    return cause ? `сайт недоступний (${cause})` : (err as Error).message;
  }

  /** If the term is about to end and no new decree has been found — remind to check it. */
  private async mobilizationEndingReminder(org: Organization, today: IsoDate) {
    const until = org.mobilizationUntil;
    if (!until || until < today || until > addDays(today, MOBILIZATION_REMIND_DAYS)) return 0;
    if (await this.notifications.wasSent('MOBILIZATION_ENDING', NIL_UUID, until)) return 0;
    const sent = await this.notifications.notifyUsers(
      `Строк мобілізації спливає ${formatUa(until)}`,
      `За останнім відомим указом загальна мобілізація триває до ${formatUa(until)}. Новий указ про продовження поки не знайдено — ` +
        'система перевіряє щодня. Після продовження строки відстрочок «до завершення мобілізації» оновляться автоматично.',
    );
    await this.notifications.markSent('MOBILIZATION_ENDING', [{ refId: NIL_UUID, refDate: until }], sent);
    return sent;
  }

  /** Deferrals that end in ≤ 5 days — one digest letter, each person once per end date. */
  private async deferralReminders(org: Organization, today: IsoDate) {
    const limit = addDays(today, REMIND_DAYS_BEFORE);
    const due: DueDeferral[] = [];
    for (const e of await this.activeEmployees(today)) {
      const end = e.deferralUntilMobilizationEnd ? org.mobilizationUntil : e.deferralUntil;
      if (!end || end < today || end > limit) continue;
      if (await this.notifications.wasSent('DEFERRAL_ENDING', e.id, end)) continue;
      due.push({ e, end });
    }
    // one digest per legal entity: its users and its extra addresses
    for (const [entityId, items] of groupByEntity(due, ({ e }) => e.legalEntityId)) {
      const lines = items.map(
        ({ e, end }) =>
          `• ${employeeFullName(e)} — відстрочка до ${formatUa(end)}${e.deferralUntilMobilizationEnd ? ' (до завершення мобілізації)' : ''}` +
          `${e.deferralMobilizationBasis || e.deferralConscriptionBasis ? `, підстава: ${e.deferralMobilizationBasis || e.deferralConscriptionBasis}` : ''}\n  ${this.env.appUrl}/employees/${e.id}`,
      );
      const sent = await this.notifications.notifyUsers(
        `${await this.prefix(entityId)}Закінчується відстрочка: ${items.length} працівн.`,
        `Через ${REMIND_DAYS_BEFORE} днів або раніше закінчується відстрочка:\n\n${lines.join('\n')}\n\n` +
          'Перевірте, чи продовжено відстрочку (Резерв+ / ТЦК), і оновіть дані в картці працівника.',
        entityId,
      );
      await this.notifications.markSent(
        'DEFERRAL_ENDING',
        items.map(({ e, end }) => ({ refId: e.id, refDate: end })),
        sent,
      );
    }
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
    for (const [entityId, items] of groupByEntity(due, (e) => e.legalEntityId)) {
      const sent = await this.notifications.notifyUsers(
        `${await this.prefix(entityId)}Закінчується бронювання: ${items.length} працівн.`,
        `Через ${REMIND_DAYS_BEFORE} днів або раніше закінчується бронювання:\n\n` +
          items
            .map(
              (e) =>
                `• ${employeeFullName(e)} — заброньовано до ${formatUa(e.reservationUntil!)}\n  ${this.env.appUrl}/employees/${e.id}`,
            )
            .join('\n'),
        entityId,
      );
      await this.notifications.markSent(
        'RESERVATION_ENDING',
        items.map((e) => ({ refId: e.id, refDate: e.reservationUntil! })),
        sent,
      );
    }
    return due.length;
  }

  /**
   * A month before the half-year password of HR / directors expires — a letter with a link to set a new one,
   * once per expiry date.
   */
  async passwordReminders(now = new Date()) {
    const { passwordMaxAgeDays: maxAge, passwordExpiryRoles: roles, passwordReminderDays: before } = this.env;
    if (!maxAge || !roles.length) return 0;
    const users = await this.users.find({ where: { isActive: true, role: In(roles) } });
    let sent = 0;
    for (const user of users) {
      const expires = passwordExpiresAt(user, maxAge, roles);
      if (!expires || expires <= now || expires.getTime() - now.getTime() > before * 86_400_000) continue;
      const refDate = expires.toISOString().slice(0, 10);
      if (await this.notifications.wasSent('PASSWORD_EXPIRING', user.id, refDate)) continue;
      const { link, expiresAt } = await this.usersService.createPasswordLink(
        user.id,
        'EXPIRING',
        PASSWORD_REMINDER_LINK_HOURS,
      );
      const ok = await this.notifications.sendPasswordExpiring({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        link,
        linkExpiresAt: expiresAt,
        passwordExpiresAt: expires,
      });
      // marked only when it really went out — otherwise tomorrow's run tries again
      if (ok) {
        await this.notifications.markSent('PASSWORD_EXPIRING', [{ refId: user.id, refDate }], 1);
        sent++;
      }
    }
    return sent;
  }

  /** «ТОВ «Приклад»: » before the subject when there are several legal entities. */
  private async prefix(entityId: string | null) {
    const entities = await this.legalEntities.all();
    if (entities.length < 2) return '';
    const entity = entities.find((e) => e.id === entityId);
    return entity ? `${entity.shortName || entity.fullName}: ` : '';
  }

  private async activeEmployees(today: IsoDate) {
    const all = await this.employees.find({ loadEagerRelations: false });
    return all.filter((e) => !e.dismissalDate || e.dismissalDate > today);
  }
}
