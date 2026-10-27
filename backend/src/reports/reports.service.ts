import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { formatUa, type IsoDate, todayIso } from '../common/utils/dates.js';
import { buildLists, buildOperationalReport, type OperationalRowData } from '../documents/builders.js';
import { deriveEmployee, toMilitaryRecord } from '../employees/employee-view.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { type DutyCategory, type ListGroup, LIST_GROUPS } from '../military/dictionaries.js';
import { personalListCells } from '../military/personal-list.js';
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

const SINCE_2020 = '2020-01-01';

const OPERATIONAL_TITLES: Record<string, string> = {
  '1.': 'Військовозобов’язані (у тому числі резервісти), із них:',
  '1.1': 'Військовозобов’язані офіцерського складу (у тому числі резервісти)',
  '1.2': 'Військовозобов’язані рядового, сержантського та старшинського складу (у тому числі резервісти)',
  '1.3': 'Військовозобов’язані-жінки (у тому числі резервісти)',
  '2.': 'Призовники',
};

export interface ListRowView {
  employeeId: string;
  group: ListGroup;
  category: DutyCategory | null;
  cells: string[];
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(EmployeeChange) private readonly changes: Repository<EmployeeChange>,
    private readonly org: OrganizationService,
  ) {}

  private loadAll() {
    return this.employees.find({
      relations: { tck: true, familyMembers: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  /** Column 18: details of notices sent to the TCK about appointment / transfer / dismissal. */
  private async positionNotices(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await this.changes.find({
      where: { employeeId: In(ids), type: In(['HIRE', 'POSITION', 'DISMISSAL']) },
      relations: { letter: true },
      order: { effectiveDate: 'ASC' },
    });
    const map = new Map<string, string[]>();
    for (const c of rows) {
      if (!c.letter) continue;
      const about = c.type === 'HIRE' ? 'про призначення' : c.type === 'POSITION' ? 'про переведення' : 'про звільнення';
      const text = `${about}: вих. № ${c.letter.number} від ${formatUa(c.letter.date)} р.`;
      map.set(c.employeeId, [...(map.get(c.employeeId) ?? []), text]);
    }
    return new Map([...map].map(([k, v]) => [k, v.join('; ')]));
  }

  /**
   * Personal military registration lists (Annex 5) on a date — a separate list per group
   * (sheets GN1…GN4R), records numbered within each group.
   * `groups` / `onlyIds` narrow it down (extract for specific employees).
   */
  async lists(date: IsoDate = todayIso(), groups: ListGroup[] = LIST_GROUPS, onlyIds?: string[]) {
    const all = (await this.loadAll()).filter(
      (e) => (!onlyIds?.length || onlyIds.includes(e.id)) && isOnPersonalListsAt(toMilitaryRecord(e), date),
    );
    const notices = await this.positionNotices(all.map((e) => e.id));

    const rows: ListRowView[] = [];
    const counts: Record<DutyCategory, number> = { LIABLE: 0, RESERVIST: 0, CONSCRIPT: 0 };
    for (const e of all) {
      const record = toMilitaryRecord(e);
      const group = listGroup(record);
      if (!group || !groups.includes(group)) continue;
      const category = dutyCategory(record);
      rows.push({ employeeId: e.id, group, category, cells: personalListCells(e, date, notices.get(e.id) ?? '') });
      if (category) counts[category]++;
    }
    // group order of the Excel file, alphabetical inside a group (loadAll is sorted by name)
    rows.sort((a, b) => LIST_GROUPS.indexOf(a.group) - LIST_GROUPS.indexOf(b.group));
    const numbers = new Map<ListGroup, number>();
    for (const row of rows) {
      const n = (numbers.get(row.group) ?? 0) + 1;
      numbers.set(row.group, n);
      row.cells[0] = String(n);
    }
    return { date, rows, counts };
  }

  async listsDocx(date: IsoDate, groups: ListGroup[], extractIds?: string[], letter?: { number: string; date: IsoDate } | null) {
    const data = await this.lists(date, groups, extractIds);
    const org = await this.org.get();
    return buildLists({
      date,
      extract: !!extractIds?.length,
      groups: LIST_GROUPS.map((group) => ({ group, rows: data.rows.filter((r) => r.group === group).map((r) => r.cells) })),
      org,
      letter,
    });
  }

  /** Operational registration report (Annex 12) — formulas OCL!D12:I16. */
  async operational(date: IsoDate = todayIso()): Promise<{ date: IsoDate; rows: OperationalRowData[] }> {
    const all = await this.loadAll();
    const rows = new Map<string, OperationalRowData>(
      ['1.1', '1.2', '1.3', '2.'].map((code) => [code, {
        code, title: OPERATIONAL_TITLES[code], total: 0, mobilizationOrders: 0, reserved: 0, other: 0, hiredSince2020: 0, dismissedSince2020: 0,
      }]),
    );

    for (const e of all) {
      const r = toMilitaryRecord(e);
      if (!isOnListsAt(r, date)) continue;
      const group = listGroup(r);
      if (!group) continue;
      const code = operationalRow(group);
      const row = rows.get(code === '2' ? '2.' : code)!;

      if (e.hireDate && e.hireDate >= SINCE_2020 && e.hireDate <= date) row.hiredSince2020++;
      if (e.dismissalDate && e.dismissalDate >= SINCE_2020 && e.dismissalDate <= date) row.dismissedSince2020++;

      if (!isEmployedAt(r, date)) continue;
      if (isReservedAt(r, date)) row.reserved++;
      else if (hasMobilizationOrder(r, date)) row.mobilizationOrders++;
      else row.other++;
      row.total++;
    }

    const sub = ['1.1', '1.2', '1.3'].map((c) => rows.get(c)!);
    const sum = (k: keyof OperationalRowData) => sub.reduce((a, r) => a + (r[k] as number), 0);
    const head: OperationalRowData = {
      code: '1.', title: OPERATIONAL_TITLES['1.'],
      total: sum('total'), mobilizationOrders: sum('mobilizationOrders'), reserved: sum('reserved'),
      other: sum('other'), hiredSince2020: sum('hiredSince2020'), dismissedSince2020: sum('dismissedSince2020'),
    };
    return { date, rows: [head, ...sub, rows.get('2.')!] };
  }

  async operationalDocx(date: IsoDate, letter?: { number: string; date: IsoDate } | null) {
    const data = await this.operational(date);
    const [org, responsible] = await Promise.all([this.org.get(), this.org.responsibleAt(letter?.date ?? date)]);
    return buildOperationalReport({ date, rows: data.rows, org, responsible, letter });
  }

  /** Summary for the dashboard. */
  async dashboard(date: IsoDate = todayIso()) {
    const [all, org, pending] = await Promise.all([
      this.loadAll(),
      this.org.get(),
      this.changes.find({
        where: { letterId: IsNull(), skipped: false },
        relations: { employee: true },
        select: { id: true, type: true, effectiveDate: true, employee: { id: true, hireOrderDate: true, dismissalOrderDate: true } },
      }),
    ]);
    const derived = all.map((e) => ({ e, d: deriveEmployee(e, date, org.alertDays) }));
    const employed = derived.filter((x) => x.d.employed);

    const byGroup = Object.fromEntries(LIST_GROUPS.map((g) => [g, 0])) as Record<ListGroup, number>;
    const byCategory: Record<string, number> = { LIABLE: 0, RESERVIST: 0, CONSCRIPT: 0 };
    for (const { d } of derived) {
      if (!d.onLists) continue;
      if (d.listGroup) byGroup[d.listGroup]++;
      if (d.dutyCategory) byCategory[d.dutyCategory]++;
    }


    const attention = derived
      .filter(({ d }) => d.employed && d.warnings.some((w) => w.level !== 'info'))
      .map(({ e, d }) => ({ id: e.id, fullName: d.fullName, warnings: d.warnings.filter((w) => w.level !== 'info') }))
      .slice(0, 50);

    return {
      date,
      employees: { employed: employed.length, onLists: derived.filter((x) => x.d.onLists).length, mobilized: derived.filter((x) => x.d.mobilized).length, reserved: employed.filter((x) => x.d.reserved).length },
      byGroup,
      byCategory,
      pendingChanges: pending.length,
      overdueChanges: pending.filter((c) => notificationDeadline(c.type, c.effectiveDate, c.employee, org.notifyDeadlineDays) < date).length,
      attention,
      organizationConfigured: !!(org.fullName && org.edrpou && org.headName),
    };
  }
}
