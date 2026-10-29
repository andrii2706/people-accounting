import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, IsNull, Repository } from 'typeorm';
import type { AuthUser } from '../common/auth.js';
import { formatUa, type IsoDate, todayIso, yearOf } from '../common/utils/dates.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { buildChangeNotice, buildEnvelopeLabels, buildSingleNotice, noticeNumber, postalCodeOf } from '../documents/builders.js';
import { noticeSnapshot, type NoticeSnapshot } from '../documents/notice-snapshot.js';
import type { Employee } from '../employees/entities/employee.entity.js';
import { CHANGE_TYPE_LABELS } from '../military/dictionaries.js';
import { ChangeNotice } from './entities/change-notice.entity.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { EmployeesService } from '../employees/employees.service.js';
import { type ListGroup, LIST_GROUPS } from '../military/dictionaries.js';
import { fullName } from '../military/employee-format.js';
import { OrganizationService } from '../organization/organization.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { StorageService } from '../storage/storage.service.js';
import { LetterSignature } from './entities/letter-signature.entity.js';
import { OutgoingLetter } from './entities/outgoing-letter.entity.js';
import type {
  CreateChangeNoticeDto,
  CreateChangeNoticesDto,
  NoticeQueryDto,
  CreateReportLetterDto,
  LetterQueryDto,
  UpdateLetterDto,
} from './letters.dto.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const P7S_MIME = 'application/pkcs7-signature';
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

/** "2 працівники", "5 працівників", "21 працівник" — Ukrainian plural forms. */
export function employeesCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'працівник' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'працівники' : 'працівників';
  return `${n} ${word}`;
}

const TYPE_TITLES = {
  CHANGE_NOTICE: 'Повідомлення про зміну облікових даних',
  LISTS: 'Списки персонального військового обліку',
  OPERATIONAL_REPORT: 'Відомість оперативного обліку',
  OTHER: 'Лист',
} as const;

/** Splits the pending changes of one person into notices: hiring, combined data changes, dismissal. */
export function noticeBatches(changes: EmployeeChange[]): EmployeeChange[][] {
  const hires = changes.filter((c) => c.type === 'HIRE').map((c) => [c]);
  const data = changes.filter((c) => c.type !== 'HIRE' && c.type !== 'DISMISSAL');
  const dismissals = changes.filter((c) => c.type === 'DISMISSAL').map((c) => [c]);
  return [...hires, ...(data.length ? [data] : []), ...dismissals];
}

@Injectable()
export class LettersService {
  constructor(
    @InjectRepository(OutgoingLetter) private readonly repo: Repository<OutgoingLetter>,
    @InjectRepository(Tck) private readonly tckRepo: Repository<Tck>,
    @InjectRepository(LetterSignature) private readonly signatureRepo: Repository<LetterSignature>,
    @InjectRepository(ChangeNotice) private readonly noticeRepo: Repository<ChangeNotice>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly employees: EmployeesService,
    private readonly reports: ReportsService,
    private readonly org: OrganizationService,
    private readonly storage: StorageService,
  ) {}

  // ---------------------------------------------------------------- create

  /** Notice letter for one employee (kept for the employee card and older clients). */
  async createChangeNotice(dto: CreateChangeNoticeDto, user: AuthUser) {
    const [letter] = await this.createChangeNotices(
      { employeeIds: [dto.employeeId], changeIds: dto.changeIds, date: dto.date },
      user,
      dto.number,
    );
    return letter;
  }

  /**
   * Notices for many employees: pending changes are grouped by the employee's TCK and one letter
   * is created per TCK. Each change becomes a stored notice (snapshot) linked to the letter.
   */
  async createChangeNotices(dto: CreateChangeNoticesDto, user: AuthUser, number?: string) {
    const ids = await this.dataSource.transaction(async (m) => {
      const employees = await Promise.all([...new Set(dto.employeeIds)].map((id) => this.employees.findEntity(id, m)));
      const where = {
        employeeId: In(employees.map((e) => e.id)),
        letterId: IsNull(),
        skipped: false,
        ...(dto.changeIds?.length ? { id: In(dto.changeIds) } : {}),
      };
      const changes = await m.getRepository(EmployeeChange).find({ where, order: { effectiveDate: 'ASC', createdAt: 'ASC' } });
      if (!changes.length) throw new BadRequestException('Немає змін, про які потрібно повідомити');

      // group by TCK; inside a letter — employees alphabetically, their changes by date
      const groups = new Map<string, Employee[]>();
      for (const e of employees) {
        if (!changes.some((c) => c.employeeId === e.id)) continue;
        const key = e.tckId ?? 'none';
        groups.set(key, [...(groups.get(key) ?? []), e]);
      }

      const created: string[] = [];
      for (const [, group] of groups) {
        group.sort((a, b) => fullName(a).localeCompare(fullName(b), 'uk'));
        const groupChanges = group.flatMap((e) => changes.filter((c) => c.employeeId === e.id));
        const single = group.length === 1;
        const letter = await this.newLetter(m, {
          type: 'CHANGE_NOTICE',
          date: dto.date ?? todayIso(),
          number: groups.size === 1 ? number : undefined,
          subject: single
            ? `${TYPE_TITLES.CHANGE_NOTICE}: ${fullName(group[0])}`
            : `${TYPE_TITLES.CHANGE_NOTICE}: ${employeesCount(group.length)}`,
          employeeId: single ? group[0].id : null,
          tckId: group[0].tckId,
          createdById: user.id,
        });
        await m.getRepository(EmployeeChange).update({ id: In(groupChanges.map((c) => c.id)) }, { letterId: letter.id });
        // three kinds of notices: hiring, dismissal, and one combined «зміна облікових даних» per person
        const notices = group.flatMap((e) => noticeBatches(changes.filter((c) => c.employeeId === e.id)).map((batch) => ({ e, batch })));
        await m.getRepository(ChangeNotice).save(notices.map(({ e, batch }, i) => this.noticeRow(letter.id, i + 1, e, batch)));
        created.push(letter.id);
      }
      return created;
    });
    return Promise.all(ids.map((id) => this.get(id)));
  }

  private noticeRow(letterId: string, sequence: number, employee: Employee, batch: EmployeeChange[]) {
    const combined = batch.length > 1 || (batch[0].type !== 'HIRE' && batch[0].type !== 'DISMISSAL');
    return this.noticeRepo.create({
      letterId,
      sequence,
      employeeId: employee.id,
      changeId: batch[0].id,
      employeeName: fullName(employee),
      changeType: combined ? 'DATA' : batch[0].type,
      effectiveDate: batch.map((c) => c.effectiveDate).sort().at(-1)!,
      content: JSON.stringify(noticeSnapshot(employee, batch)),
    });
  }

  /**
   * Letters created before notices were stored have no snapshot rows — build them once from
   * the current employee data, so that every notice ends up in the database.
   */
  private async ensureNotices(letter: OutgoingLetter): Promise<ChangeNotice[]> {
    const existing = await this.noticeRepo.find({ where: { letterId: letter.id }, order: { sequence: 'ASC' } });
    if (existing.length || letter.type !== 'CHANGE_NOTICE') return existing;
    const changes = await this.dataSource
      .getRepository(EmployeeChange)
      .find({ where: { letterId: letter.id }, order: { effectiveDate: 'ASC', createdAt: 'ASC' } });
    const rows: ChangeNotice[] = [];
    for (const [i, c] of changes.entries()) {
      const employee = await this.employees.findEntity(c.employeeId);
      rows.push(this.noticeRow(letter.id, i + 1, employee, [c]));
    }
    return rows.length ? this.noticeRepo.save(rows) : [];
  }

  /** Envelope labels for the given letters (sender — organization, recipient — the letter's TCK). */
  async labels(ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) throw new BadRequestException('Оберіть хоча б один лист');
    if (unique.length > 200) throw new BadRequestException('Не більше 200 листів за раз');
    const letters = await this.repo.find({ where: { id: In(unique) }, relations: { tck: true }, order: { year: 'ASC', sequence: 'ASC' } });
    if (letters.length !== unique.length) throw new NotFoundException('Деякі листи не знайдено');
    const org = await this.org.get();
    const sender = {
      name: org.shortName || org.fullName,
      address: org.address,
      postalCode: postalCodeOf(org.postalCode, org.address),
      phone: org.phone,
    };
    const buffer = await buildEnvelopeLabels(
      letters.map((l) => ({
        sender,
        recipient: {
          name: l.tck?.name ?? '',
          address: l.tck?.address ?? '',
          postalCode: postalCodeOf(l.tck?.postalCode, l.tck?.address),
          phone: l.tck?.phone ?? '',
        },
      })),
    );
    const filename = letters.length === 1 ? `Наклейка ${letters[0].number.replace(/[\\/:*?"<>|]/g, '-')}.docx` : `Наклейки (${letters.length}).docx`;
    return { buffer, filename };
  }

  /** Stored notices, optionally for one employee — the history shown in the employee card. */
  async notices(query: NoticeQueryDto) {
    const rows = await this.noticeRepo.find({
      where: { ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.letterId ? { letterId: query.letterId } : {}) },
      relations: { letter: true },
      order: { createdAt: 'DESC', sequence: 'ASC' },
    });
    const totals = new Map<string, number>();
    for (const letterId of new Set(rows.map((r) => r.letterId))) {
      totals.set(letterId, await this.noticeRepo.countBy({ letterId }));
    }
    return rows.map(({ content: _c, letter, ...n }) => ({
      ...n,
      typeLabel: CHANGE_TYPE_LABELS[n.changeType],
      number: noticeNumber(letter.number, n.sequence, totals.get(n.letterId) ?? 1),
      letter: { id: letter.id, number: letter.number, date: letter.date, status: letter.status },
    }));
  }

  /** One notice (Annex 4) as a separate .docx. */
  async noticeDocument(id: string) {
    const notice = await this.noticeRepo.findOne({ where: { id }, relations: { letter: { tck: true } } });
    if (!notice) throw new NotFoundException('Повідомлення не знайдено');
    const total = await this.noticeRepo.countBy({ letterId: notice.letterId });
    const org = await this.org.getAt(notice.letter.date);
    const responsible = await this.org.responsibleAt(notice.letter.date);
    const snapshot = JSON.parse(notice.content) as NoticeSnapshot;
    const ref = { number: notice.letter.number, date: notice.letter.date };
    const buffer = await buildSingleNotice({
      letter: ref,
      tck: notice.letter.tck,
      org,
      responsible,
      total,
      notice: { ...snapshot, sequence: notice.sequence, changeType: notice.changeType },
    });
    const number = noticeNumber(ref.number, notice.sequence, total).replace(/[\\/:*?"<>|]/g, '-');
    return { buffer, filename: `Повідомлення ${number} ${snapshot.lastName}.docx`, letterId: notice.letterId };
  }

  async createReportLetter(dto: CreateReportLetterDto, user: AuthUser) {
    const tck = dto.tckId ? await this.tckRepo.findOneBy({ id: dto.tckId }) : null;
    const id = await this.dataSource.transaction(async (m) => {
      const letter = await this.newLetter(m, {
        type: dto.type,
        date: dto.date ?? todayIso(),
        number: dto.number,
        subject: `${TYPE_TITLES[dto.type]}${dto.employeeIds?.length ? ' (витяг)' : ''} станом на ${formatUa(dto.reportDate)}`,
        tckId: tck?.id ?? null,
        params: { reportDate: dto.reportDate, groups: dto.groups ?? null, employeeIds: dto.employeeIds ?? null },
        createdById: user.id,
      });
      return letter.id;
    });
    return this.get(id);
  }

  /** Next number in the yearly outgoing register — under an advisory lock to avoid duplicates. */
  private async newLetter(m: EntityManager, data: Partial<OutgoingLetter> & { date: IsoDate; number?: string }) {
    const year = yearOf(data.date);
    await m.query('SELECT pg_advisory_xact_lock($1)', [year]);
    const { max } = (await m
      .getRepository(OutgoingLetter)
      .createQueryBuilder('l')
      .select('COALESCE(MAX(l.sequence), 0)', 'max')
      .where('l.year = :year', { year })
      .getRawOne<{ max: number }>())!;
    const sequence = Number(max) + 1;
    const org = await this.org.get();
    const number = data.number?.trim() || `${org.letterNumberPrefix}${sequence}`;
    return m.getRepository(OutgoingLetter).save(m.getRepository(OutgoingLetter).create({ ...data, year, sequence, number }));
  }

  // ---------------------------------------------------------------- read / update

  list(query: LetterQueryDto) {
    const qb = this.repo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.tck', 'tck')
      .leftJoinAndSelect('l.employee', 'employee')
      .orderBy('l.year', 'DESC')
      .addOrderBy('l.sequence', 'DESC');
    if (query.type) qb.andWhere('l.type = :type', { type: query.type });
    if (query.status) qb.andWhere('l.status = :status', { status: query.status });
    if (query.employeeId) {
      // single-employee letters and multi-employee letters that contain a notice for this employee
      qb.andWhere(
        '(l.employeeId = :employeeId OR EXISTS (SELECT 1 FROM change_notices n WHERE n."letterId" = l.id AND n."employeeId" = :employeeId))',
        { employeeId: query.employeeId },
      );
    }
    if (query.year) qb.andWhere('l.year = :year', { year: Number(query.year) });
    return qb.getMany().then((letters) => letters.map(({ documentKey, ...l }) => ({
      ...l,
      frozen: !!documentKey,
      employee: l.employee ? { id: l.employee.id, fullName: fullName(l.employee) } : null,
    })));
  }

  async get(id: string) {
    const letter = await this.repo.findOne({ where: { id }, relations: { tck: true, employee: true, changes: true } });
    if (!letter) throw new NotFoundException('Лист не знайдено');
    const signatureCount = await this.signatureRepo.countBy({ letterId: id });
    const notices = await this.ensureNotices(letter);
    const { documentKey: _key, ...rest } = letter;
    return {
      ...rest,
      frozen: !!letter.documentKey,
      signatureCount,
      notices: notices.map(({ content: _c, ...n }) => ({
        ...n,
        typeLabel: CHANGE_TYPE_LABELS[n.changeType],
        number: noticeNumber(letter.number, n.sequence, notices.length),
      })),
      employee: letter.employee ? { id: letter.employee.id, fullName: fullName(letter.employee) } : null,
    };
  }

  async update(id: string, dto: UpdateLetterDto) {
    const letter = await this.repo.findOneBy({ id });
    if (!letter) throw new NotFoundException();
    if (letter.status === 'SENT') throw new BadRequestException('Надісланий лист змінювати не можна');
    if (letter.documentKey) {
      const changesContent = (['number', 'date', 'subject', 'tckId'] as const).some((k) => dto[k] !== undefined && dto[k] !== letter[k]);
      if (changesContent) {
        throw new BadRequestException('Документ зафіксовано для підписання — спершу скасуйте фіксацію (якщо ще немає підписів)');
      }
    }
    if (dto.tckId) {
      const tck = await this.tckRepo.findOneBy({ id: dto.tckId });
      if (!tck) throw new BadRequestException('ТЦК не знайдено');
      letter.tckId = tck.id;
    }
    const { tckId: _ignored, ...rest } = dto;
    Object.assign(letter, rest);
    await this.repo.save(letter);
    return this.get(id);
  }

  async remove(id: string) {
    const letter = await this.repo.findOneBy({ id });
    if (!letter) throw new NotFoundException();
    if (letter.status === 'SENT') throw new BadRequestException('Надісланий лист видаляти не можна');
    if (await this.signatureRepo.countBy({ letterId: id })) throw new BadRequestException('Підписаний лист видаляти не можна');
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(EmployeeChange).update({ letterId: id }, { letterId: null });
      await m.getRepository(OutgoingLetter).delete(id);
    });
  }

  async markSent(id: string, user: AuthUser) {
    const letter = await this.repo.findOneBy({ id });
    if (!letter) throw new NotFoundException();
    letter.status = 'SENT';
    letter.sentAt = new Date();
    await this.repo.save(letter);
    await this.audit(id, 'SEND', { channel: [null, 'manual'] }, user);
    return this.get(id);
  }

  // ---------------------------------------------------------------- documents

  async document(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const letter = await this.repo.findOne({ where: { id }, relations: { changes: true } });
    if (!letter) throw new NotFoundException();
    // a document frozen for signing is never regenerated
    if (letter.documentKey) {
      const { buffer, filename } = await this.frozenDocument(id);
      return { buffer, filename };
    }
    const safeNumber = letter.number.replace(/[\\/:*?"<>|]/g, '-');
    const ref = { number: letter.number, date: letter.date };

    if (letter.type === 'CHANGE_NOTICE') {
      const rows = await this.ensureNotices(letter);
      if (!rows.length) throw new BadRequestException('У листі немає повідомлень');
      const [org, responsible, tck] = await Promise.all([
        this.org.getAt(letter.date),
        this.org.responsibleAt(letter.date),
        letter.tckId ? this.tckRepo.findOneBy({ id: letter.tckId }) : null,
      ]);
      const notices = rows.map((r) => ({ ...(JSON.parse(r.content) as NoticeSnapshot), sequence: r.sequence, changeType: r.changeType }));
      const buffer = await buildChangeNotice({ letter: ref, tck, notices, org, responsible });
      const people = new Set(rows.map((r) => r.employeeName));
      const who = people.size === 1 ? notices[0].lastName : employeesCount(people.size);
      return { buffer, filename: `Повідомлення ${safeNumber} ${who}.docx` };
    }

    const params = letter.params as { reportDate?: string; groups?: ListGroup[] | null; employeeIds?: string[] | null };
    const reportDate = params.reportDate ?? letter.date;
    if (letter.type === 'LISTS') {
      const buffer = await this.reports.listsDocx(reportDate, params.groups ?? LIST_GROUPS, params.employeeIds ?? undefined, ref);
      return { buffer, filename: `Списки ${safeNumber} ${reportDate}.docx` };
    }
    if (letter.type === 'OPERATIONAL_REPORT') {
      const buffer = await this.reports.operationalDocx(reportDate, ref);
      return { buffer, filename: `Відомість ${safeNumber} ${reportDate}.docx` };
    }
    throw new BadRequestException('Для цього типу листа документ не формується');
  }

  /** Document frozen for e-signing, with an integrity check by SHA-256. */
  async frozenDocument(id: string) {
    const letter = await this.repo.findOneBy({ id });
    if (!letter) throw new NotFoundException('Лист не знайдено');
    if (!letter.documentKey || !letter.documentSha256) {
      throw new BadRequestException('Спочатку зафіксуйте документ для підписання');
    }
    const buffer = await this.storage.get(letter.documentKey);
    if (sha256(buffer) !== letter.documentSha256) {
      throw new ConflictException('Цілісність зафіксованого документа порушено — зверніться до адміністратора');
    }
    return { letter, buffer, filename: letter.documentFilename ?? 'document.docx' };
  }

  /** Document + all .p7s signature files; null when the letter is not signed. */
  async signedAttachments(id: string) {
    const sigs = await this.signatureRepo.find({ where: { letterId: id }, order: { createdAt: 'ASC' } });
    if (!sigs.length) return null;
    const { buffer, filename } = await this.frozenDocument(id);
    const attachments = [{ filename, content: buffer, contentType: DOCX_MIME }];
    for (const [i, sig] of sigs.entries()) {
      attachments.push({
        filename: sigs.length === 1 ? `${filename}.p7s` : `${filename}.${i + 1}.p7s`,
        content: await this.storage.get(sig.fileKey),
        contentType: P7S_MIME,
      });
    }
    return attachments;
  }

  private audit(entityId: string, action: string, diff: Record<string, [unknown, unknown]>, user: AuthUser) {
    return this.dataSource.getRepository(AuditLog).save({ entity: 'letter', entityId, action, diff, userId: user.id, userName: user.fullName });
  }
}
