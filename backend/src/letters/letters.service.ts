import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, IsNull, Repository } from 'typeorm';
import type { AuthUser } from '../common/auth.js';
import { formatUa, type IsoDate, todayIso, yearOf } from '../common/utils/dates.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { buildChangeNotice } from '../documents/builders.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { EmployeesService } from '../employees/employees.service.js';
import { MailService } from '../mail/mail.service.js';
import { type ListGroup, LIST_GROUPS } from '../military/dictionaries.js';
import { fullName } from '../military/employee-format.js';
import { OrganizationService } from '../organization/organization.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailLog } from './entities/email-log.entity.js';
import { LetterSignature } from './entities/letter-signature.entity.js';
import { OutgoingLetter } from './entities/outgoing-letter.entity.js';
import type {
  CreateChangeNoticeDto,
  CreateReportLetterDto,
  LetterQueryDto,
  SendLetterDto,
  UpdateLetterDto,
} from './letters.dto.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const P7S_MIME = 'application/pkcs7-signature';
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

const TYPE_TITLES = {
  CHANGE_NOTICE: 'Повідомлення про зміну облікових даних',
  LISTS: 'Списки персонального військового обліку',
  OPERATIONAL_REPORT: 'Відомість оперативного обліку',
  OTHER: 'Лист',
} as const;

@Injectable()
export class LettersService {
  constructor(
    @InjectRepository(OutgoingLetter) private readonly repo: Repository<OutgoingLetter>,
    @InjectRepository(EmailLog) private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(Tck) private readonly tckRepo: Repository<Tck>,
    @InjectRepository(LetterSignature) private readonly signatureRepo: Repository<LetterSignature>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly employees: EmployeesService,
    private readonly reports: ReportsService,
    private readonly org: OrganizationService,
    private readonly mail: MailService,
    private readonly storage: StorageService,
  ) {}

  // ---------------------------------------------------------------- create

  async createChangeNotice(dto: CreateChangeNoticeDto, user: AuthUser) {
    const employee = await this.employees.findEntity(dto.employeeId);
    const id = await this.dataSource.transaction(async (m) => {
      const where = { employeeId: employee.id, letterId: IsNull(), skipped: false, ...(dto.changeIds?.length ? { id: In(dto.changeIds) } : {}) };
      const changes = await m.getRepository(EmployeeChange).find({ where, order: { effectiveDate: 'ASC' } });
      if (!changes.length) throw new BadRequestException('Немає змін, про які потрібно повідомити');

      const letter = await this.newLetter(m, {
        type: 'CHANGE_NOTICE',
        date: dto.date ?? todayIso(),
        number: dto.number,
        subject: `${TYPE_TITLES.CHANGE_NOTICE}: ${fullName(employee)}`,
        employeeId: employee.id,
        tckId: employee.tckId,
        recipientEmail: employee.tck?.email ?? '',
        createdById: user.id,
      });
      await m.getRepository(EmployeeChange).update({ id: In(changes.map((c) => c.id)) }, { letterId: letter.id });
      return letter.id;
    });
    return this.get(id);
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
        recipientEmail: tck?.email ?? '',
        params: { reportDate: dto.reportDate, groups: dto.groups ?? null, employeeIds: dto.employeeIds ?? null },
        createdById: user.id,
      });
      return letter.id;
    });
    return this.get(id);
  }

  /** Наступний номер у журналі вихідних за рік — під advisory-lock, щоб не було дублів. */
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
    if (query.employeeId) qb.andWhere('l.employeeId = :employeeId', { employeeId: query.employeeId });
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
    const emails = await this.emailLogRepo.find({ where: { letterId: id }, order: { createdAt: 'DESC' } });
    const signatureCount = await this.signatureRepo.countBy({ letterId: id });
    const { documentKey: _key, ...rest } = letter;
    return {
      ...rest,
      frozen: !!letter.documentKey,
      signatureCount,
      employee: letter.employee ? { id: letter.employee.id, fullName: fullName(letter.employee) } : null,
      emails,
      mailConfigured: this.mail.isConfigured,
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
      if (!dto.recipientEmail && tck.email) letter.recipientEmail = tck.email;
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
    // зафіксований для підпису документ не перегенеровується
    if (letter.documentKey) {
      const { buffer, filename } = await this.frozenDocument(id);
      return { buffer, filename };
    }
    const safeNumber = letter.number.replace(/[\\/:*?"<>|]/g, '-');
    const ref = { number: letter.number, date: letter.date };

    if (letter.type === 'CHANGE_NOTICE') {
      if (!letter.employeeId) throw new BadRequestException('Лист не прив’язаний до працівника');
      const employee = await this.employees.findEntity(letter.employeeId);
      if (letter.tckId && letter.tckId !== employee.tckId) {
        employee.tck = await this.tckRepo.findOneBy({ id: letter.tckId });
      }
      const [org, responsible] = await Promise.all([this.org.get(), this.org.responsibleAt(letter.date)]);
      const changes = [...letter.changes].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
      const buffer = await buildChangeNotice({ letter: ref, employee, changes, org, responsible });
      return { buffer, filename: `Повідомлення ${safeNumber} ${employee.lastName}.docx` };
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

  /** Зафіксований (для КЕП) документ з перевіркою цілісності за SHA-256. */
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

  /** Документ + усі файли підписів .p7s; null, якщо лист не підписано. */
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

  // ---------------------------------------------------------------- email

  async send(id: string, dto: SendLetterDto, user: AuthUser) {
    const letter = await this.repo.findOne({ where: { id }, relations: { tck: true } });
    if (!letter) throw new NotFoundException();
    const to = dto.to || letter.recipientEmail || letter.tck?.email;
    if (!to) throw new BadRequestException('Не вказано email отримувача (додайте email ТЦК у довіднику)');

    const org = await this.org.get();
    const signed = await this.signedAttachments(id);
    let attachments = signed;
    if (!attachments) {
      const { buffer, filename } = await this.document(id);
      attachments = [{ filename, content: buffer, contentType: DOCX_MIME }];
    }
    const subject = `${org.shortName ? `${org.shortName}: ` : ''}${letter.subject} (вих. № ${letter.number} від ${formatUa(letter.date)})`;
    const text = [
      dto.message?.trim() ||
        (signed
          ? 'Добрий день!\n\nНадсилаємо документ з питань військового обліку працівників, підписаний кваліфікованим електронним підписом (файли .p7s — окремий підпис CAdES до документа).'
          : 'Добрий день!\n\nНадсилаємо документи з питань військового обліку працівників. Оригінали буде направлено поштою.'),
      '',
      `${org.headPosition} ${org.shortName}`.trim(),
      org.headName,
      org.phone ? `тел. ${org.phone}` : '',
    ].filter((l) => l !== undefined).join('\n');

    const log = this.emailLogRepo.create({ letterId: id, to, subject, attachments: attachments.map((a) => a.filename), sentById: user.id, status: 'FAILED' });
    try {
      const result = await this.mail.send({ to, cc: dto.cc, subject, text, attachments });
      log.status = 'SENT';
      log.messageId = result.messageId;
      if (result.dev) log.error = `SMTP не налаштовано — лист збережено: ${result.savedTo}`;
      letter.status = 'SENT';
      letter.sentAt = new Date();
      letter.recipientEmail = to;
    } catch (err) {
      log.error = err instanceof Error ? err.message : String(err);
      letter.status = 'FAILED';
    }
    delete (letter as Partial<OutgoingLetter>).tck;
    await this.emailLogRepo.save(log);
    await this.repo.save(letter);
    await this.audit(id, 'SEND', { to: [null, to], status: [null, log.status] }, user);
    if (log.status === 'FAILED') throw new BadRequestException(`Не вдалося надіслати: ${log.error}`);
    return this.get(id);
  }

  private audit(entityId: string, action: string, diff: Record<string, [unknown, unknown]>, user: AuthUser) {
    return this.dataSource.getRepository(AuditLog).save({ entity: 'letter', entityId, action, diff, userId: user.id, userName: user.fullName });
  }
}
