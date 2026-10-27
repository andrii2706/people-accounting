import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, type EntityManager, IsNull, Repository } from 'typeorm';
import { type AuditAction, AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth.js';
import { blindIndex } from '../common/crypto/field-encryption.js';
import { type FieldError, fieldErrors } from '../common/validators.js';
import { formatUa, todayIso } from '../common/utils/dates.js';
import { CHANGE_TYPE_LABELS, type ChangeType } from '../military/dictionaries.js';
import { familyText, passportText } from '../military/employee-format.js';
import { isConscript, notificationDeadline } from '../military/military-logic.js';
import { OrganizationService } from '../organization/organization.service.js';
import { deriveEmployee } from './employee-view.js';
import type {
  CreateEmployeeDto,
  DismissEmployeeDto,
  EmployeeQueryDto,
  UpdateChangeDto,
  UpdateEmployeeDto,
} from './employees.dto.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { EmployeeChange } from './entities/employee-change.entity.js';
import { Employee } from './entities/employee.entity.js';
import { FamilyMember } from './entities/family-member.entity.js';

const NULLABLE_DATES = new Set<keyof Employee>([
  'birthDate', 'passportIssuedAt', 'foreignPassportIssuedAt', 'foreignPassportValidUntil', 'educationDocumentDate',
  'positionSince', 'hireDate', 'hireOrderDate', 'dismissalDate', 'dismissalOrderDate', 'militaryDocIssuedAt',
  'tckRegisteredAt', 'fitnessDate', 'reservationUntil', 'deferralUntil', 'mobilizationOrderDate', 'mobilizedAt',
  'demobilizedAt',
]);

/** Fields whose change produces a TCK notice, and how to describe them. */
interface ChangeRule {
  type: ChangeType;
  fields: (keyof Employee)[];
  describe: (e: Employee) => string;
  /** Do not create a change if the new value is empty. */
  requireValue?: boolean;
}

const CHANGE_RULES: ChangeRule[] = [
  { type: 'LAST_NAME', fields: ['lastName'], describe: (e) => e.lastName },
  { type: 'FIRST_NAME', fields: ['firstName'], describe: (e) => e.firstName },
  { type: 'MIDDLE_NAME', fields: ['middleName'], describe: (e) => e.middleName },
  { type: 'POSITION', fields: ['position'], describe: (e) => e.position, requireValue: true },
  { type: 'REGISTERED_ADDRESS', fields: ['registeredAddress'], describe: (e) => e.registeredAddress, requireValue: true },
  { type: 'ACTUAL_ADDRESS', fields: ['actualAddress'], describe: (e) => e.actualAddress, requireValue: true },
  { type: 'PASSPORT', fields: ['passportType', 'passportSeries', 'passportNumber'], describe: passportText, requireValue: true },
  // Foreign passport, education and marital status are no longer reported (Resolution No. 812 of 10.06.2026);
  // the types stay in ChangeType for the history of earlier notices.
];

/**
 * Reservation is used only when "Заброньований" is chosen explicitly: then its basis and term are
 * required (same rule as on the frontend), otherwise the reservation data is cleared.
 */
function applyReservation(e: Employee) {
  if (e.reserved && isConscript(e)) e.reserved = false;
  if (!e.reserved) {
    e.reserved = false;
    e.reservationBasis = '';
    e.reservationUntil = null;
    e.specialAccountingCertificate = '';
    return;
  }
  const errors: FieldError[] = [];
  if (!e.reservationBasis?.trim()) errors.push({ field: 'reservationBasis', message: 'Вкажіть підставу бронювання' });
  if (!e.reservationUntil) errors.push({ field: 'reservationUntil', message: 'Вкажіть строк бронювання' });
  if (errors.length) throw fieldErrors(errors);
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    @InjectRepository(EmployeeChange) private readonly changeRepo: Repository<EmployeeChange>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly org: OrganizationService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- read

  async list(query: EmployeeQueryDto) {
    const date = query.date ?? todayIso();
    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.tck', 'tck')
      .orderBy('e.lastName', 'ASC')
      .addOrderBy('e.firstName', 'ASC');

    if (query.search?.trim()) {
      const raw = query.search.trim();
      const term = `%${raw.toLowerCase()}%`;
      // RNOKPP is encrypted — search only by exact value via the blind index
      const rnokppHash = /^\d{10}$/.test(raw) ? blindIndex(raw) : null;
      qb.andWhere(
        new Brackets((w) => {
          w.where("LOWER(e.lastName || ' ' || e.firstName || ' ' || e.middleName) LIKE :term", { term })
            .orWhere('LOWER(e.personnelNumber) LIKE :term', { term })
            .orWhere('LOWER(e.position) LIKE :term', { term });
          if (rnokppHash) w.orWhere('e.rnokppHash = :rnokppHash', { rnokppHash });
        }),
      );
    }
    const status = query.status ?? 'active';
    if (status === 'active') {
      qb.andWhere('(e.dismissalDate IS NULL OR e.dismissalDate >= :date)', { date });
    } else if (status === 'dismissed') {
      qb.andWhere('e.dismissalDate < :date', { date });
    }
    if (query.tckId) qb.andWhere('e.tckId = :tckId', { tckId: query.tckId });

    const [employees, pendingCounts, org] = await Promise.all([qb.getMany(), this.pendingCountsByEmployee(), this.org.get()]);

    let items = employees.map((e) => ({
      id: e.id,
      personnelNumber: e.personnelNumber,
      gender: e.gender,
      lastName: e.lastName,
      firstName: e.firstName,
      middleName: e.middleName,
      birthDate: e.birthDate,
      position: e.position,
      department: e.department,
      hireDate: e.hireDate,
      dismissalDate: e.dismissalDate,
      rankCode: e.rankCode,
      vos: e.vos,
      tckName: e.tck?.name ?? '',
      reservationUntil: e.reserved ? e.reservationUntil : null,
      pendingChanges: pendingCounts.get(e.id) ?? 0,
      ...deriveEmployee(e, date, org.alertDays),
    }));

    if (query.group) items = items.filter((i) => (query.group === 'NONE' ? !i.listGroup : i.listGroup === query.group));
    if (query.category) items = items.filter((i) => i.dutyCategory === query.category);
    if (query.withWarnings === 'true') items = items.filter((i) => i.warnings.length > 0 || i.pendingChanges > 0);

    return { date, total: items.length, items };
  }

  async findEntity(id: string, manager?: EntityManager): Promise<Employee> {
    const repo = manager?.getRepository(Employee) ?? this.repo;
    const employee = await repo.findOne({ where: { id }, relations: { tck: true, familyMembers: true } });
    if (!employee) throw new NotFoundException('Працівника не знайдено');
    employee.familyMembers?.sort((a, b) => (a.birthDate ?? '').localeCompare(b.birthDate ?? ''));
    return employee;
  }

  async get(id: string, viewer?: AuthUser) {
    const [employee, org] = await Promise.all([this.findEntity(id), this.org.get()]);
    if (viewer) await this.auditService.log('employee', id, 'VIEW', {}, viewer);
    const changes = await this.changeRepo.find({
      where: { employeeId: id },
      relations: { letter: true },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });
    return {
      ...employee,
      derived: deriveEmployee(employee, todayIso(), org.alertDays),
      changes: changes.map((c) => this.changeView(c, org.notifyDeadlineDays, employee)),
    };
  }

  auditTrail(id: string) {
    return this.auditRepo.find({ where: { entity: 'employee', entityId: id }, order: { createdAt: 'DESC' }, take: 200 });
  }

  // ---------------------------------------------------------------- write

  async create(dto: CreateEmployeeDto, user: AuthUser) {
    const id = await this.dataSource.transaction((m) => this.createIn(m, dto, user));
    return this.get(id);
  }

  /**
   * Bulk creation (import from a file) — all or nothing, in one transaction.
   * `hireNotices: false` — do not queue "прийняття на роботу" notices (people hired long ago).
   */
  async createMany(dtos: CreateEmployeeDto[], user: AuthUser, opts: { hireNotices: boolean; source: string }) {
    return this.dataSource.transaction(async (m) => {
      const ids: string[] = [];
      for (const dto of dtos) ids.push(await this.createIn(m, dto, user, opts));
      return ids;
    });
  }

  private async createIn(m: EntityManager, dto: CreateEmployeeDto, user: AuthUser, opts: { hireNotices?: boolean; source?: string } = {}) {
    const { changeMeta, familyMembers, ...data } = dto;
    const employee = m.getRepository(Employee).create(this.normalize(data) as Partial<Employee>);
    applyReservation(employee);
    employee.familyMembers = (familyMembers ?? []).map((f) => m.getRepository(FamilyMember).create({ ...f, middleName: f.middleName ?? '', birthDate: f.birthDate || null }));
    const saved = await m.getRepository(Employee).save(employee);

    if (saved.hireDate && opts.hireNotices !== false) {
      await this.addChange(m, saved, 'HIRE', '', saved.position, saved.hireDate, changeMeta?.basis || this.hireBasis(saved), user);
    }
    const diff: Record<string, [unknown, unknown]> = { fullName: [null, `${saved.lastName} ${saved.firstName}`] };
    if (opts.source) diff.source = [null, opts.source];
    await this.log(m, saved.id, 'CREATE', diff, user);
    return saved.id;
  }

  async update(id: string, dto: UpdateEmployeeDto, user: AuthUser) {
    const { changeMeta, familyMembers, ...data } = dto;
    await this.dataSource.transaction(async (m) => {
      const employee = await this.findEntity(id, m);
      const before = structuredClone(employee);
      const beforeFamily = familyText(employee);

      Object.assign(employee, this.normalize(data));
      applyReservation(employee);
      if (familyMembers) {
        await m.getRepository(FamilyMember).delete({ employeeId: id });
        employee.familyMembers = familyMembers.map((f) =>
          m.getRepository(FamilyMember).create({ ...f, employeeId: id, middleName: f.middleName ?? '', birthDate: f.birthDate || null }),
        );
      }
      // otherwise TypeORM takes the FK from the previously loaded relation instead of tckId
      if (data.tckId !== undefined) delete (employee as Partial<Employee>).tck;
      const saved = await m.getRepository(Employee).save(employee);
      const after = await this.findEntity(id, m);

      // audit every changed field
      const diff: Record<string, [unknown, unknown]> = {};
      for (const key of Object.keys(data) as (keyof Employee)[]) {
        if (before[key] !== saved[key]) diff[key] = [before[key], saved[key]];
      }
      if (familyMembers && beforeFamily !== familyText(after)) diff.familyMembers = [beforeFamily, familyText(after)];

      // changes the TCK must be notified about
      const effectiveDate = changeMeta?.effectiveDate ?? todayIso();
      for (const rule of CHANGE_RULES) {
        const changed = rule.fields.some((f) => before[f] !== after[f]);
        if (!changed) continue;
        const newValue = rule.describe(after);
        if (rule.requireValue && !newValue) continue;
        const basis = changeMeta?.basis || (rule.type === 'POSITION' ? after.positionOrder : '');
        await this.addChange(m, after, rule.type, rule.describe(before), newValue, effectiveDate, basis, user);
      }
      if (!before.hireDate && after.hireDate) {
        await this.addChange(m, after, 'HIRE', '', after.position, after.hireDate, this.hireBasis(after), user);
      }
      if (!before.dismissalDate && after.dismissalDate) {
        await this.addChange(m, after, 'DISMISSAL', after.position, '', after.dismissalDate, this.dismissalBasis(after), user);
      }

      if (Object.keys(diff).length) await this.log(m, id, 'UPDATE', diff, user);
    });
    return this.get(id);
  }

  async dismiss(id: string, dto: DismissEmployeeDto, user: AuthUser) {
    await this.dataSource.transaction(async (m) => {
      const employee = await this.findEntity(id, m);
      if (employee.dismissalDate) throw new BadRequestException('Працівника вже звільнено');
      if (employee.hireDate && dto.dismissalDate < employee.hireDate) {
        throw new BadRequestException('Дата звільнення раніша за дату прийняття');
      }
      employee.dismissalDate = dto.dismissalDate;
      employee.dismissalOrderNumber = dto.dismissalOrderNumber ?? '';
      employee.dismissalOrderDate = dto.dismissalOrderDate || null;
      await m.getRepository(Employee).save(employee);
      await this.addChange(m, employee, 'DISMISSAL', employee.position, '', dto.dismissalDate, dto.basis || this.dismissalBasis(employee), user);
      await this.log(m, id, 'DISMISS', { dismissalDate: [null, dto.dismissalDate] }, user);
    });
    return this.get(id);
  }

  async remove(id: string, user: AuthUser) {
    const employee = await this.findEntity(id);
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(Employee).delete(id);
      await this.log(m, id, 'DELETE', { fullName: [`${employee.lastName} ${employee.firstName}`, null] }, user);
    });
  }

  // ---------------------------------------------------------------- changes

  /** All changes the TCK has not been notified about yet. */
  async pendingChanges() {
    const org = await this.org.get();
    const changes = await this.changeRepo.find({
      where: { letterId: IsNull(), skipped: false },
      relations: { employee: { tck: true } },
      order: { effectiveDate: 'ASC' },
    });
    return changes.map((c) => ({
      ...this.changeView(c, org.notifyDeadlineDays, c.employee),
      employee: {
        id: c.employee.id,
        fullName: `${c.employee.lastName} ${c.employee.firstName} ${c.employee.middleName}`.trim(),
        tckId: c.employee.tckId,
        tckName: c.employee.tck?.name ?? '',
        tckEmail: c.employee.tck?.email ?? '',
      },
    }));
  }

  async updateChange(changeId: string, dto: UpdateChangeDto) {
    const change = await this.changeRepo.findOneBy({ id: changeId });
    if (!change) throw new NotFoundException();
    if (change.letterId) throw new BadRequestException('Зміна вже включена до листа');
    Object.assign(change, dto);
    return this.changeRepo.save(change);
  }

  // ---------------------------------------------------------------- helpers

  private changeView(c: EmployeeChange, deadlineDays: number, e?: Employee | null) {
    const deadline = notificationDeadline(c.type, c.effectiveDate, e, deadlineDays);
    return {
      id: c.id,
      type: c.type,
      typeLabel: CHANGE_TYPE_LABELS[c.type],
      oldValue: c.oldValue,
      newValue: c.newValue,
      effectiveDate: c.effectiveDate,
      basis: c.basis,
      skipped: c.skipped,
      deadline,
      overdue: !c.letterId && !c.skipped && deadline < todayIso(),
      letter: c.letter ? { id: c.letter.id, number: c.letter.number, date: c.letter.date, status: c.letter.status } : null,
      createdAt: c.createdAt,
    };
  }

  /** If a change of the same type has not been notified yet — update it instead of duplicating. */
  private async addChange(
    m: EntityManager,
    e: Employee,
    type: ChangeType,
    oldValue: string,
    newValue: string,
    effectiveDate: string,
    basis: string,
    user: AuthUser,
  ) {
    const repo = m.getRepository(EmployeeChange);
    const pending = await repo.findOneBy({ employeeId: e.id, type, letterId: IsNull(), skipped: false });
    if (pending) {
      pending.newValue = newValue;
      pending.effectiveDate = effectiveDate;
      if (basis) pending.basis = basis;
      if (pending.oldValue === newValue) {
        await repo.delete(pending.id); // reverted to the original value — nothing to notify
        return;
      }
      await repo.save(pending);
      return;
    }
    await repo.save(repo.create({ employeeId: e.id, type, oldValue, newValue, effectiveDate, basis, createdById: user.id }));
  }

  private hireBasis(e: Employee) {
    if (!e.hireOrderNumber && !e.hireOrderDate) return '';
    return `наказ про прийняття на роботу${e.hireOrderNumber ? ` № ${e.hireOrderNumber}` : ''}${e.hireOrderDate ? ` від ${formatUa(e.hireOrderDate)} р.` : ''}`;
  }

  private dismissalBasis(e: Employee) {
    if (!e.dismissalOrderNumber && !e.dismissalOrderDate) return '';
    return `наказ про звільнення${e.dismissalOrderNumber ? ` № ${e.dismissalOrderNumber}` : ''}${e.dismissalOrderDate ? ` від ${formatUa(e.dismissalOrderDate)} р.` : ''}`;
  }

  private normalize(data: Partial<Record<keyof Employee, unknown>>) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (NULLABLE_DATES.has(key as keyof Employee)) out[key] = value || null;
      else if (typeof value === 'string') out[key] = value.trim();
      else out[key] = value;
    }
    if (typeof out.lastName === 'string') out.lastName = capitalizeName(out.lastName);
    if (typeof out.firstName === 'string') out.firstName = capitalizeName(out.firstName);
    if (typeof out.middleName === 'string') out.middleName = capitalizeName(out.middleName);
    return out;
  }

  private async pendingCountsByEmployee() {
    const rows = await this.changeRepo
      .createQueryBuilder('c')
      .select('c.employeeId', 'employeeId')
      .addSelect('COUNT(*)::int', 'count')
      .where('c.letterId IS NULL AND c.skipped = false')
      .groupBy('c.employeeId')
      .getRawMany<{ employeeId: string; count: number }>();
    return new Map(rows.map((r) => [r.employeeId, r.count]));
  }

  private log(m: EntityManager, entityId: string, action: AuditAction, diff: Record<string, [unknown, unknown]>, user: AuthUser) {
    return this.auditService.log('employee', entityId, action, diff, user, m);
  }
}

/** «шевченко-ковальська» → «Шевченко-Ковальська» (like UPPER(MID(...,1,1)) in the formulas). */
function capitalizeName(value: string) {
  return value
    .split(/([-\s’'])/)
    .map((part) => (part.length > 1 || /[a-zа-яіїєґ]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}
