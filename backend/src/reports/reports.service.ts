import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { formatUa, todayIso } from '../common/utils/dates.utils.js';
import { buildLists, buildOperationalReport } from '../documents/builders.js';
import { deriveEmployee, toMilitaryRecord } from '../employees/utils/employee-view.utils.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { LIST_GROUPS, LIST_SECTIONS, listSection } from '../military/dictionaries.js';
import { hasDeferralAt, listRowStatus, personalListCells } from '../military/personal-list.js';
import {
  dutyCategory,
  hasMobilizationOrder,
  isEmployedAt,
  isOnListsAt,
  isOnPersonalListsAt,
  isReservedAt,
  listGroup,
  notificationDeadline,
  operationalRow,
} from '../military/military-logic.js';
import { OrganizationService } from '../organization/organization.service.js';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import { entityQuota, quotaStanding } from '../legal-entities/utils/quota.utils.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type { ListGroup, ListSection, DutyCategory } from '../shared/interfaces/dictionary.interface.js';
import type {
  ListRowView,
  ListsDocxOptions,
  ListsFilter,
  TckExtractSummary,
} from '../shared/interfaces/report.interface.js';
import type { OperationalRowData } from '../shared/interfaces/document.interface.js';
import type { EntityQuota } from '../shared/interfaces/legal-entity.interface.js';
import type { LetterNumberDate } from '../shared/interfaces/letter.interface.js';
import { OPERATIONAL_REPORT_SINCE } from './reports.constants.js';
import { OPERATIONAL_REPORT_TITLES } from './reports.constants.js';
import type { OperationalReportData } from '../shared/interfaces/document.interface.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(EmployeeChange) private readonly changes: Repository<EmployeeChange>,
    @InjectRepository(Tck) private readonly tcks: Repository<Tck>,
    private readonly org: OrganizationService,
    private readonly legalEntities: LegalEntitiesService,
  ) {}

  /** Employees of one legal entity, or of all of them (null). */
  private loadAll(legalEntityId: string | null = null) {
    return this.employees.find({
      where: legalEntityId ? { legalEntityId } : {},
      relations: { tck: true, familyMembers: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  /** Column 18: details of notices sent to the TCK about appointment / transfer / dismissal. */
  private async positionNotices(ids: string[]) {
    const texts = new Map<string, string>();
    const lastDates = new Map<string, IsoDate>();
    if (!ids.length) return { texts, lastDates };
    const rows = await this.changes.find({
      where: { employeeId: In(ids), type: In(['HIRE', 'POSITION', 'DISMISSAL']) },
      relations: { letter: true },
      order: { effectiveDate: 'ASC' },
    });
    const map = new Map<string, string[]>();
    for (const c of rows) {
      if (!c.letter) continue;
      const about =
        c.type === 'HIRE' ? 'про призначення' : c.type === 'POSITION' ? 'про переведення' : 'про звільнення';
      const text = `${about}: вих. № ${c.letter.number} від ${formatUa(c.letter.date)} р.`;
      map.set(c.employeeId, [...(map.get(c.employeeId) ?? []), text]);
      const last = lastDates.get(c.employeeId);
      if (!last || c.letter.date > last) lastDates.set(c.employeeId, c.letter.date);
    }
    for (const [k, v] of map) texts.set(k, v.join('; '));
    return { texts, lastDates };
  }

  /** Changes of each employee that are still waiting for a letter to the TCK. */
  private async pendingNoticeCounts(ids: string[]) {
    const counts = new Map<string, number>();
    if (!ids.length) return counts;
    const rows = await this.changes.find({
      where: { employeeId: In(ids), letterId: IsNull(), skipped: false },
      select: { id: true, employeeId: true },
    });
    for (const c of rows) counts.set(c.employeeId, (counts.get(c.employeeId) ?? 0) + 1);
    return counts;
  }

  /**
   * Personal military registration lists (Annex 5) on a date — four separate lists: officers;
   * rank-and-file, sergeants and petty officers; women; conscripts (reservists go into the list of their
   * composition). Records are numbered within each list.
   * `groups` / `onlyIds` narrow it down (extract for specific employees).
   */
  async lists(date: IsoDate = todayIso(), filter: ListsFilter = {}) {
    const { groups = LIST_GROUPS, onlyIds, legalEntityId = null, tckId = null } = filter;
    const all = (await this.loadAll(legalEntityId)).filter(
      (e) =>
        (!onlyIds?.length || onlyIds.includes(e.id)) &&
        (!tckId || e.tckId === tckId) &&
        isOnPersonalListsAt(toMilitaryRecord(e), date),
    );
    const ids = all.map((e) => e.id);
    const [notices, pending, org] = await Promise.all([
      this.positionNotices(ids),
      this.pendingNoticeCounts(ids),
      this.org.get(),
    ]);

    const rows: ListRowView[] = [];
    const counts: Record<DutyCategory, number> = { LIABLE: 0, RESERVIST: 0, CONSCRIPT: 0 };
    for (const e of all) {
      const record = toMilitaryRecord(e);
      const group = listGroup(record);
      if (!group || !groups.includes(group)) continue;
      const category = dutyCategory(record);
      rows.push({
        employeeId: e.id,
        tckId: e.tckId,
        group,
        section: listSection(group),
        category,
        cells: personalListCells(e, date, notices.texts.get(e.id) ?? ''),
        status: listRowStatus(e, date, {
          mobilizationUntil: org.mobilizationUntil,
          alertDays: org.alertDays,
          pendingNotices: pending.get(e.id) ?? 0,
          lastNoticeDate: notices.lastDates.get(e.id) ?? null,
        }),
      });
      if (category) counts[category]++;
    }
    // list order: officers, soldiers, women, conscripts; alphabetical inside a list (loadAll is sorted by name)
    rows.sort((a, b) => LIST_SECTIONS.indexOf(a.section) - LIST_SECTIONS.indexOf(b.section));
    const numbers = new Map<ListSection, number>();
    for (const row of rows) {
      const n = (numbers.get(row.section) ?? 0) + 1;
      numbers.set(row.section, n);
      row.cells[0] = String(n);
    }
    return { date, rows, counts };
  }

  /**
   * Lists (Annex 5) as .docx. With specific employees or a TCK it is an extract («ВИТЯГ ІЗ СПИСКІВ»):
   * extracts are sent to every TCK about the people registered there.
   */
  async listsDocx(date: IsoDate, options: ListsDocxOptions = {}) {
    const entityId = await this.legalEntities.forDocument(options.legalEntityId);
    const data = await this.lists(date, { ...options, legalEntityId: entityId });
    const org = await this.legalEntities.requisites(entityId);
    return buildLists({
      date,
      extract: !!options.onlyIds?.length || !!options.tckId,
      sections: LIST_SECTIONS.map((section) => ({
        section,
        rows: data.rows.filter((r) => r.section === section).map((r) => r.cells),
      })),
      org,
      letter: options.letter,
    });
  }

  /** Extracts overview: every TCK with the number of people in each of the four lists. */
  async extracts(date: IsoDate = todayIso(), legalEntityId: string | null = null): Promise<TckExtractSummary[]> {
    const [data, tcks] = await Promise.all([
      this.lists(date, { legalEntityId }),
      this.tcks.find({ select: { id: true, name: true } }),
    ]);
    const names = new Map(tcks.map((t) => [t.id, t.name]));
    const byTck = new Map<string | null, TckExtractSummary>();
    for (const row of data.rows) {
      let item = byTck.get(row.tckId);
      if (!item) {
        item = {
          tckId: row.tckId,
          tckName: row.tckId ? (names.get(row.tckId) ?? '') : '',
          sections: Object.fromEntries(LIST_SECTIONS.map((s) => [s, 0])) as Record<ListSection, number>,
          total: 0,
        };
        byTck.set(row.tckId, item);
      }
      item.sections[row.section]++;
      item.total++;
    }
    // people without a TCK go last: an extract cannot be sent anywhere until the TCK is filled in
    return [...byTck.values()].sort((a, b) =>
      !a.tckId ? 1 : !b.tckId ? -1 : a.tckName.localeCompare(b.tckName, 'uk'),
    );
  }

  /** Operational registration report (Annex 12) — formulas OCL!D12:I16. */
  async operational(date: IsoDate = todayIso(), legalEntityId: string | null = null): Promise<OperationalReportData> {
    const all = await this.loadAll(legalEntityId);
    const rows = new Map<string, OperationalRowData>(
      ['1.1', '1.2', '1.3', '2.'].map((code) => [
        code,
        {
          code,
          title: OPERATIONAL_REPORT_TITLES[code],
          total: 0,
          mobilizationOrders: 0,
          reserved: 0,
          other: 0,
          hiredSince2020: 0,
          dismissedSince2020: 0,
        },
      ]),
    );

    for (const e of all) {
      const r = toMilitaryRecord(e);
      if (!isOnListsAt(r, date)) continue;
      const group = listGroup(r);
      if (!group) continue;
      const code = operationalRow(group);
      const row = rows.get(code === '2' ? '2.' : code)!;

      if (e.hireDate && e.hireDate >= OPERATIONAL_REPORT_SINCE && e.hireDate <= date) row.hiredSince2020++;
      if (e.dismissalDate && e.dismissalDate >= OPERATIONAL_REPORT_SINCE && e.dismissalDate <= date)
        row.dismissedSince2020++;

      if (!isEmployedAt(r, date)) continue;
      if (isReservedAt(r, date)) row.reserved++;
      else if (hasMobilizationOrder(r, date)) row.mobilizationOrders++;
      else row.other++;
      row.total++;
    }

    const sub = ['1.1', '1.2', '1.3'].map((c) => rows.get(c)!);
    const sum = (k: keyof OperationalRowData) => sub.reduce((a, r) => a + (r[k] as number), 0);
    const head: OperationalRowData = {
      code: '1.',
      title: OPERATIONAL_REPORT_TITLES['1.'],
      total: sum('total'),
      mobilizationOrders: sum('mobilizationOrders'),
      reserved: sum('reserved'),
      other: sum('other'),
      hiredSince2020: sum('hiredSince2020'),
      dismissedSince2020: sum('dismissedSince2020'),
    };
    return { date, rows: [head, ...sub, rows.get('2.')!] };
  }

  async operationalDocx(date: IsoDate, letter?: LetterNumberDate | null, legalEntityId?: string | null) {
    const entityId = await this.legalEntities.forDocument(legalEntityId);
    const data = await this.operational(date, entityId);
    const [org, responsible] = await Promise.all([
      this.legalEntities.requisites(entityId),
      this.legalEntities.responsible(entityId),
    ]);
    return buildOperationalReport({ date, rows: data.rows, org, responsible, letter });
  }

  /** The overview: of one legal entity (scope) or of all of them (the main administrator). */
  async dashboard(date: IsoDate = todayIso(), scope: string | null = null) {
    const [all, org, entities, pending] = await Promise.all([
      this.loadAll(scope),
      this.org.get(),
      this.legalEntities.all(scope),
      this.changes.find({
        where: { letterId: IsNull(), skipped: false, ...(scope ? { employee: { legalEntityId: scope } } : {}) },
        relations: { employee: true },
        select: {
          id: true,
          type: true,
          effectiveDate: true,
          employee: { id: true, hireOrderDate: true, dismissalOrderDate: true },
        },
      }),
    ]);
    const derived = all.map((e) => ({ e, d: deriveEmployee(e, date, org.alertDays) }));
    const employed = derived.filter((x) => x.d.employed);

    const byGroup = Object.fromEntries(LIST_GROUPS.map((g) => [g, 0])) as Record<ListGroup, number>;
    const bySection = Object.fromEntries(LIST_SECTIONS.map((g) => [g, 0])) as Record<ListSection, number>;
    const byCategory: Record<string, number> = { LIABLE: 0, RESERVIST: 0, CONSCRIPT: 0 };
    for (const { d } of derived) {
      if (!d.onLists) continue;
      if (d.listGroup) {
        byGroup[d.listGroup]++;
        bySection[listSection(d.listGroup)]++;
      }
      if (d.dutyCategory) byCategory[d.dutyCategory]++;
    }

    // deferrals in force on the date (a fixed date, or «до завершення мобілізації»)
    const deferrals = employed.filter(({ e }) => hasDeferralAt(e, date, org.mobilizationUntil)).length;

    // reservation quota of every legal entity: percent × its working military-liable men;
    // only its own reservations use the places
    const reserved = employed.filter((x) => x.d.reserved);
    const own = reserved.filter(({ e }) => e.reservedBy !== 'OTHER');
    const standing = all.map((e) => quotaStanding(e, date));
    const quotas: EntityQuota[] = entities.map((entity) => entityQuota(entity, standing));
    // the card sums the entities that have a quota; without any quota — just how many are reserved
    const withQuota = quotas.filter((q) => q.quota !== null);
    const quota = withQuota.length ? withQuota.reduce((sum, q) => sum + q.quota!, 0) : null;
    const reservedCompany = withQuota.length ? withQuota.reduce((sum, q) => sum + q.reservedCompany, 0) : own.length;

    const attention = derived
      .filter(({ d }) => d.employed && d.warnings.some((w) => w.level !== 'info'))
      .map(({ e, d }) => ({ id: e.id, fullName: d.fullName, warnings: d.warnings.filter((w) => w.level !== 'info') }))
      .slice(0, 50);

    return {
      date,
      employees: {
        employed: employed.length,
        onLists: derived.filter((x) => x.d.onLists).length,
        mobilized: derived.filter((x) => x.d.mobilized).length,
        reserved: employed.filter((x) => x.d.reserved).length,
      },
      byGroup,
      bySection,
      byCategory,
      deferrals,
      reservation: {
        quota,
        reservedCompany,
        reservedOther: reserved.length - own.length,
        available: withQuota.length ? withQuota.reduce((sum, q) => sum + q.available!, 0) : null,
        exceeded: quotas.some((q) => q.exceeded),
        /** Per legal entity — shown when there are several. */
        entities: quotas,
      },
      mobilizationUntil: org.mobilizationUntil,
      pendingChanges: pending.length,
      overdueChanges: pending.filter(
        (c) => notificationDeadline(c.type, c.effectiveDate, c.employee, org.notifyDeadlineDays) < date,
      ).length,
      attention,
      // at least one legal entity with a head and a responsible person — the documents need them
      organizationConfigured: entities.some((e) => e.headName && e.responsibleName),
    };
  }
}
