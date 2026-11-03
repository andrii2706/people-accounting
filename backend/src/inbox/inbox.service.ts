import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { formatUa, todayIso } from '../common/utils/dates.js';
import { deriveEmployee } from '../employees/employee-view.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { CHANGE_TYPE_LABELS } from '../military/dictionaries.js';
import { fullName } from '../military/employee-format.js';
import { notificationDeadline } from '../military/military-logic.js';
import { OrganizationService } from '../organization/organization.service.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type { InboxItem, InboxKind, InboxView } from '../shared/interfaces/inbox.interface.js';
import type { WarningLevel } from '../shared/interfaces/employee.interface.js';
import { InboxRead } from './inbox-read.entity.js';

/** Warnings about terms; the rest of the card warnings are «card data». */
const DEADLINE_CODES = new Set([
  'RESERVATION_EXPIRED',
  'RESERVATION_EXPIRING',
  'DEFERRAL_EXPIRED',
  'DEFERRAL_EXPIRING',
  'VLK_OVERDUE',
  'VLK_SOON',
]);
const LEVEL_ORDER: Record<WarningLevel, number> = { danger: 0, warning: 1, info: 2 };
const KIND_ORDER: Record<InboxKind, number> = { DEADLINE: 0, TCK: 1, CARD: 2 };

/**
 * In-app notifications about employees: deadlines, unreported changes for the TCK, problems in the card.
 * They are computed from the current data (the same checks as the warnings in the card), so they disappear
 * by themselves once the data is fixed; only the «read» mark of each user is stored.
 */
@Injectable()
export class InboxService {
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(EmployeeChange) private readonly changes: Repository<EmployeeChange>,
    @InjectRepository(InboxRead) private readonly reads: Repository<InboxRead>,
    private readonly org: OrganizationService,
  ) {}

  async list(userId: string, date: IsoDate = todayIso()): Promise<InboxView> {
    const items = await this.compute(date);
    const read = new Set(
      (await this.reads.find({ where: { userId, key: In(items.map((i) => i.key)) }, select: { key: true } })).map(
        (r) => r.key,
      ),
    );
    for (const item of items) item.read = read.has(item.key);
    items.sort(
      (a, b) =>
        Number(a.read) - Number(b.read) ||
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
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
  async markAllRead(userId: string): Promise<void> {
    const keys = (await this.compute(todayIso())).map((i) => i.key);
    await this.reads.delete(keys.length ? { userId, key: Not(In(keys)) } : { userId });
    await this.markRead(userId, keys);
  }

  private async compute(date: IsoDate): Promise<InboxItem[]> {
    const [org, employees, pending] = await Promise.all([
      this.org.get(),
      this.employees.find({ relations: { militaryDocuments: true } }),
      this.changes.find({
        where: { letterId: IsNull(), skipped: false },
        relations: { employee: true },
        order: { effectiveDate: 'ASC' },
      }),
    ]);
    const items: InboxItem[] = [];

    for (const e of employees) {
      const d = deriveEmployee(e, date, org.alertDays);
      if (!d.employed) continue;
      for (const w of d.warnings) {
        if (w.level === 'info') continue;
        items.push({
          key: `${w.code}:${e.id}:${w.ref ?? ''}`,
          kind: DEADLINE_CODES.has(w.code) ? 'DEADLINE' : 'CARD',
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
}
