import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { entityScope } from '../common/utils/entity-scope.utils.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';
import { In, IsNull, Not, Repository } from 'typeorm';
import { formatUa, todayIso } from '../common/utils/dates.utils.js';
import { deriveEmployee } from '../employees/utils/employee-view.utils.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { CHANGE_TYPE_LABELS } from '../military/dictionaries.js';
import { fullName } from '../military/employee-format.js';
import { notificationDeadline } from '../military/military-logic.js';
import { OrganizationService } from '../organization/organization.service.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type { InboxItem, InboxView } from '../shared/interfaces/inbox.interface.js';
import { InboxRead } from './inbox-read.entity.js';
import { INBOX_DEADLINE_CODES } from './inbox.constants.js';
import { INBOX_KIND_ORDER } from './inbox.constants.js';
import { INBOX_LEVEL_ORDER, INBOX_QUOTA_ENDS_DAYS } from './inbox.constants.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { entityQuota, quotaStanding } from '../legal-entities/utils/quota.utils.js';
import { addDays } from '../common/utils/dates.utils.js';

/**
 * In-app notifications about employees: deadlines, unreported changes for the TCK, problems in the card —
 * and about the reservation quota of the legal entity (exceeded, the decision ends).
 * They are computed from the current data (the same checks as the warnings in the card), so they disappear
 * by themselves once the data is fixed; only the «read» mark of each user is stored.
 */
@Injectable()
export class InboxService {
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(EmployeeChange) private readonly changes: Repository<EmployeeChange>,
    @InjectRepository(InboxRead) private readonly reads: Repository<InboxRead>,
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly org: OrganizationService,
  ) {}

  /** Notifications about the employees of the user's legal entity (the main administrator — of all). */
  async list(user: AuthUser, date: IsoDate = todayIso()): Promise<InboxView> {
    const userId = user.id;
    // an account without a legal entity (a director who has not added his yet) has nothing to be notified about
    if (user.role !== 'ADMIN' && !user.legalEntityId) return { items: [], unread: 0, date };
    const items = await this.compute(date, entityScope(user));
    const read = new Set(
      (await this.reads.find({ where: { userId, key: In(items.map((i) => i.key)) }, select: { key: true } })).map(
        (r) => r.key,
      ),
    );
    for (const item of items) item.read = read.has(item.key);
    items.sort(
      (a, b) =>
        Number(a.read) - Number(b.read) ||
        INBOX_LEVEL_ORDER[a.level] - INBOX_LEVEL_ORDER[b.level] ||
        INBOX_KIND_ORDER[a.kind] - INBOX_KIND_ORDER[b.kind] ||
        a.employeeName.localeCompare(b.employeeName, 'uk'),
    );
    return { items, unread: items.filter((i) => !i.read).length, date };
  }

  async markRead(userId: string, keys: string[]): Promise<void> {
    const unique = [...new Set(keys)].filter((k) => k.length <= 200);
    if (!unique.length) return;
    await this.reads
      .createQueryBuilder()
      .insert()
      .values(unique.map((key) => ({ userId, key })))
      .orIgnore()
      .execute();
  }

  /** Marks everything current as read and forgets marks of notifications that no longer exist. */
  async markAllRead(user: AuthUser): Promise<void> {
    const userId = user.id;
    if (user.role !== 'ADMIN' && !user.legalEntityId) return;
    const keys = (await this.compute(todayIso(), entityScope(user))).map((i) => i.key);
    await this.reads.delete(keys.length ? { userId, key: Not(In(keys)) } : { userId });
    await this.markRead(userId, keys);
  }

  private async compute(date: IsoDate, scope: Scope): Promise<InboxItem[]> {
    const [org, employees, pending, entities] = await Promise.all([
      this.org.get(),
      this.employees.find({ where: scope ? { legalEntityId: scope } : {}, relations: { militaryDocuments: true } }),
      this.changes.find({
        where: { letterId: IsNull(), skipped: false, ...(scope ? { employee: { legalEntityId: scope } } : {}) },
        relations: { employee: true },
        order: { effectiveDate: 'ASC' },
      }),
      this.entities.find({ where: scope ? { id: scope } : {} }),
    ]);
    const items: InboxItem[] = this.quotaItems(entities, employees, date);

    for (const e of employees) {
      const d = deriveEmployee(e, date, org.alertDays);
      if (!d.employed) continue;
      for (const w of d.warnings) {
        if (w.level === 'info') continue;
        items.push({
          key: `${w.code}:${e.id}:${w.ref ?? ''}`,
          kind: INBOX_DEADLINE_CODES.has(w.code) ? 'DEADLINE' : 'CARD',
          level: w.level,
          employeeId: e.id,
          employeeName: d.fullName,
          message: w.message,
          link: 'EMPLOYEE',
          read: false,
        });
      }
    }

    for (const c of pending) {
      if (!c.employee) continue;
      const deadline = notificationDeadline(c.type, c.effectiveDate, c.employee, org.notifyDeadlineDays);
      const overdue = deadline < date;
      const what = `${CHANGE_TYPE_LABELS[c.type]} від ${formatUa(c.effectiveDate)}`;
      items.push({
        // a change that becomes overdue is a new notification
        key: `TCK:${c.id}:${overdue ? 'overdue' : 'new'}`,
        kind: 'TCK',
        level: overdue ? 'danger' : 'warning',
        employeeId: c.employee.id,
        employeeName: fullName(c.employee),
        message: overdue
          ? `Прострочено повідомлення ТЦК (${what}): строк минув ${formatUa(deadline)}. Надішліть повідомлення якнайшвидше.`
          : `Треба повідомити ТЦК (${what}) до ${formatUa(deadline)}.`,
        link: 'NOTICES',
        read: false,
      });
    }
    return items;
  }

  /**
   * The reservation quota of every legal entity of the scope: exceeded (a new notification when the exceeding
   * grows) and the decision ending in 14 days. Numbers only — the names are on the quota page.
   */
  private quotaItems(entities: LegalEntity[], employees: Employee[], date: IsoDate): InboxItem[] {
    const standing = employees.map((e) => quotaStanding(e, date));
    const items: InboxItem[] = [];
    for (const entity of entities) {
      const q = entityQuota(entity, standing, date);
      const base = {
        kind: 'QUOTA' as const,
        employeeId: '',
        employeeName: entity.shortName || entity.fullName,
        link: 'QUOTA' as const,
        legalEntityId: entity.id,
        read: false,
      };
      if (q.exceeded && q.quota !== null) {
        const over = q.reservedCompany - q.quota;
        items.push({
          ...base,
          key: `QUOTA:${entity.id}:over:${over}`,
          level: 'danger',
          message: `Квоту бронювання перевищено на ${over}: місць ${q.quota}, заброньовано підприємством ${q.reservedCompany}. Перевірте бронювання або подайте документи на збільшення квоти.`,
        });
      }
      if (q.quota !== null && q.validUntil && !q.expired && q.validUntil <= addDays(date, INBOX_QUOTA_ENDS_DAYS)) {
        items.push({
          ...base,
          key: `QUOTA:${entity.id}:ends:${q.validUntil}`,
          level: 'warning',
          message: `Рішення про квоту бронювання діє до ${formatUa(q.validUntil)}. Подайте документи на продовження заздалегідь.`,
        });
      }
    }
    return items;
  }
}
