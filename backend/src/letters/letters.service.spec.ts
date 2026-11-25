import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HR } from '../../test/fixtures.js';
import { wire } from '../../test/wiring.js';
import { sha256 } from '../common/utils/hash.utils.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Tck } from '../dictionaries/tck.entity.js';
import type { ListSnapshotsService } from '../reports/lists/list-snapshots.service.js';
import type { ReportsService } from '../reports/reports.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { ChangeNotice } from './entities/change-notice.entity.js';
import { LetterSignature } from './entities/letter-signature.entity.js';
import { OutgoingLetter } from './entities/outgoing-letter.entity.js';
import { LettersService } from './letters.service.js';

let w: ReturnType<typeof wire>;
let service: LettersService;
let reports: Record<string, ReturnType<typeof vi.fn>>;
let snapshots: { rowsFor: ReturnType<typeof vi.fn> };
let files: Map<string, Buffer>;

const letters = () => w.db.getRepository<OutgoingLetter>(OutgoingLetter);
const changes = () => w.db.getRepository<EmployeeChange>(EmployeeChange);
const notices = () => w.db.getRepository<ChangeNotice>(ChangeNotice);
const signatures = () => w.db.getRepository<LetterSignature>(LetterSignature);

const ROW = (employeeId: string, section = 'SOLDIERS') => ({ employeeId, section, group: 'MALE' });

beforeEach(() => {
  w = wire();
  letters().qb({ getRawOne: () => ({ max: Math.max(0, ...letters().rows.map((l) => l.sequence ?? 0)) }) });
  reports = {
    lists: vi.fn(async () => ({ rows: [ROW('e1')] })),
    extractRows: vi.fn(async (rows: unknown[]) => rows),
    listSheets: vi.fn(async () => new Map([['SOLDIERS', 2]])),
    listsDocx: vi.fn(async () => ({ kind: 'docx', buffer: Buffer.from('lists') })),
    operationalDocx: vi.fn(async () => Buffer.from('report')),
  };
  snapshots = { rowsFor: vi.fn(async () => ({ id: 's1', date: '2026-11-01', rows: [ROW('e1')] })) };
  files = new Map();
  const storage = { get: async (key: string) => files.get(key) ?? Buffer.alloc(0) } as unknown as StorageService;
  service = new LettersService(
    letters() as never,
    w.db.getRepository(Tck) as never,
    signatures() as never,
    notices() as never,
    w.db.dataSource as never,
    w.employees,
    reports as unknown as ReportsService,
    w.legalEntities,
    storage,
    snapshots as unknown as ListSnapshotsService,
  );
});

/** Two people of one TCK and one of another, each with a change waiting for a letter. */
function queue() {
  const a = w.seedEmployee({ lastName: 'Бойко', tckId: 't1' });
  const b = w.seedEmployee({ lastName: 'Андрієнко', tckId: 't1' });
  const c = w.seedEmployee({ lastName: 'Ващук', tckId: 't2' });
  changes().seed(
    {
      employeeId: a.id,
      type: 'LAST_NAME',
      oldValue: 'Бойко-Старий',
      newValue: 'Бойко',
      effectiveDate: '2026-11-02',
    } as never,
    {
      employeeId: a.id,
      type: 'ACTUAL_ADDRESS',
      oldValue: '',
      newValue: 'м. Тестове, вул. Нова, 1',
      effectiveDate: '2026-11-03',
    } as never,
    { employeeId: b.id, type: 'HIRE', oldValue: '', newValue: 'Інженер', effectiveDate: '2026-11-01' } as never,
    { employeeId: c.id, type: 'DISMISSAL', oldValue: 'Інженер', newValue: '', effectiveDate: '2026-11-04' } as never,
  );
  return { a, b, c };
}

describe('LettersService.createChangeNotices — об’єднаний лист за ТЦК', () => {
  it('лист на кожен ТЦК; у листі — люди за абеткою, зміни даних однієї людини — одне повідомлення', async () => {
    const { a, b, c } = queue();
    const created = await service.createChangeNotices({ employeeIds: [a.id, b.id, c.id], date: '2026-11-05' }, HR);
    expect(created).toHaveLength(2);
    const t1 = created.find((l) => l.tckId === 't1')!;
    expect(t1.subject).toContain('2 працівники');
    expect(t1.employee).toBeNull();
    expect(t1.notices.map((n) => [n.employeeName.split(' ')[0], n.changeType])).toEqual([
      ['Андрієнко', 'HIRE'],
      ['Бойко', 'DATA'],
    ]);
    expect(t1.notices.map((n) => n.number)).toEqual([`${t1.number}/1`, `${t1.number}/2`]);
    const t2 = created.find((l) => l.tckId === 't2')!;
    expect(t2.subject).toContain('Ващук');
    expect(t2.notices[0].changeType).toBe('DISMISSAL');
    expect(changes().rows.every((ch) => ch.letterId)).toBe(true);
  });

  it('номери листів — наступні в реєстрі юрособи з її префіксом; свій номер — лише коли лист один', async () => {
    const { a, c } = queue();
    letters().seed({
      legalEntityId: 'le1',
      year: 2026,
      sequence: 41,
      number: 'ВО-41',
      date: '2026-01-10',
      type: 'OTHER',
    } as never);
    const [first, second] = await service.createChangeNotices(
      { employeeIds: [a.id, c.id], date: '2026-11-05' },
      HR,
      '999',
    );
    expect([first.number, second.number].sort((a, b) => a.localeCompare(b))).toEqual(['ВО-42', 'ВО-43']);
    const one = w.seedEmployee({ lastName: 'Окремий' });
    changes().seed({ employeeId: one.id, type: 'LAST_NAME', effectiveDate: '2026-11-05' } as never);
    const [own] = await service.createChangeNotices({ employeeIds: [one.id], date: '2026-11-05' }, HR, ' 15/2 ');
    expect(own.number).toBe('15/2');
    expect(w.db.queries[0].sql).toContain('pg_advisory_xact_lock');
  });

  it('лише обрані зміни; без змін — помилка', async () => {
    const { a } = queue();
    const pick = changes().rows.find((ch) => ch.type === 'LAST_NAME')!;
    const [letter] = await service.createChangeNotices({ employeeIds: [a.id], changeIds: [pick.id] }, HR);
    expect(letter.notices).toHaveLength(1);
    expect(changes().rows.find((ch) => ch.type === 'ACTUAL_ADDRESS')?.letterId).toBeNull();
    const idle = w.seedEmployee();
    await expect(service.createChangeNotices({ employeeIds: [idle.id] }, HR)).rejects.toThrow('Немає змін');
  });

  it('createChangeNotice (одна людина): тема з ПІБ, працівник у листі', async () => {
    const { a } = queue();
    const letter = await service.createChangeNotice({ employeeId: a.id, date: '2026-11-05' } as never, HR);
    expect(letter.subject).toContain('Бойко');
    expect(letter.employee?.id).toBe(a.id);
  });
});

describe('LettersService.createExternalNotice — внесене вручну', () => {
  it('надісланий лист зі справжнім номером, зміни прив’язано, у журналі CREATE', async () => {
    const { a } = queue();
    const ids = changes()
      .rows.filter((ch) => ch.employeeId === a.id)
      .map((ch) => ch.id);
    const letter = await service.createExternalNotice(
      {
        employeeId: a.id,
        changeIds: ids,
        date: '2026-10-01',
        number: '7/10',
        changeType: 'DATA',
        description: '  нова адреса ',
      } as never,
      HR,
    );
    expect(letter).toMatchObject({ number: '7/10', status: 'SENT', external: true });
    expect(JSON.parse(notices().rows[0].content).change).toBe('нова адреса');
    expect(w.db.getRepository(AuditLog).rows.at(-1)).toMatchObject({ entity: 'letter', action: 'CREATE' });
  });

  it('чужі чи вже повідомлені зміни — помилка біля поля', async () => {
    const { a, c } = queue();
    const foreign = changes().rows.find((ch) => ch.employeeId === c.id)!;
    await expect(
      service.createExternalNotice(
        { employeeId: a.id, changeIds: [foreign.id], date: '2026-10-01', number: '1', changeType: 'DATA' } as never,
        HR,
      ),
    ).rejects.toMatchObject({ response: { errors: [expect.objectContaining({ field: 'changeIds' })] } });
  });
});

describe('LettersService: редагування, видалення, надсилання', () => {
  async function draft() {
    const { a } = queue();
    const [letter] = await service.createChangeNotices({ employeeIds: [a.id] }, HR);
    return letter;
  }

  it('update: новий ТЦК і тема; неіснуючий ТЦК — помилка; надісланий — не можна', async () => {
    const letter = await draft();
    const updated = await service.update(letter.id, { tckId: 't2', subject: 'Нова тема' } as never);
    expect(updated).toMatchObject({ tckId: 't2', subject: 'Нова тема' });
    await expect(service.update(letter.id, { tckId: 'nope' } as never)).rejects.toThrow('ТЦК не знайдено');
    await service.markSent(letter.id, HR);
    await expect(service.update(letter.id, { subject: 'x' } as never)).rejects.toThrow(
      'Надісланий лист змінювати не можна',
    );
  });

  it('зафіксований для підпису: зміст не змінюється', async () => {
    const letter = await draft();
    letters().rows[0].documentKey = 'k1';
    await expect(service.update(letter.id, { number: '1' } as never)).rejects.toThrow('зафіксовано');
  });

  it('remove: зміни повертаються в чергу; надісланий чи підписаний — не можна', async () => {
    const letter = await draft();
    await service.remove(letter.id);
    expect(letters().rows).toHaveLength(0);
    expect(changes().rows.filter((ch) => ch.letterId)).toHaveLength(0);
    const second = await draft();
    signatures().seed({ letterId: second.id, fileKey: 'f', signerName: 'x', certSerial: '1', size: 1 } as never);
    await expect(service.remove(second.id)).rejects.toThrow('Підписаний');
    await service.markSent(second.id, HR);
    await expect(service.remove(second.id)).rejects.toThrow('Надісланий');
    await expect(service.remove('nope')).rejects.toThrow('Лист не знайдено');
  });

  it('markSent: статус, дата надсилання, журнал SEND', async () => {
    const letter = await draft();
    const sent = await service.markSent(letter.id, HR);
    expect(sent.status).toBe('SENT');
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect(w.db.getRepository(AuditLog).rows.some((r) => r.action === 'SEND')).toBe(true);
  });

  it('assertAccess: чужий лист — «не знайдено»', async () => {
    const letter = await draft();
    await expect(service.assertAccess(letter.id, 'le1')).resolves.toBeUndefined();
    await expect(service.assertAccess(letter.id, 'le2')).rejects.toThrow('Лист не знайдено');
  });
});

describe('LettersService: документи', () => {
  it('повідомлення ТЦК → .docx з номером і прізвищем', async () => {
    const { a } = queue();
    const [letter] = await service.createChangeNotices({ employeeIds: [a.id] }, HR);
    const file = await service.document(letter.id);
    expect(file.filename).toBe(`Повідомлення ${letter.number} Бойко.docx`);
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('окреме повідомлення та історія повідомлень працівника', async () => {
    const { a, b } = queue();
    const [letter] = await service.createChangeNotices({ employeeIds: [a.id, b.id] }, HR);
    const list = await service.notices({ employeeId: a.id } as never);
    expect(list).toHaveLength(1);
    expect(list[0].number).toBe(`${letter.number}/2`);
    const one = await service.noticeDocument(list[0].id);
    expect(one.filename).toContain('Бойко');
    await expect(service.noticeDocument(list[0].id, 'le2')).rejects.toThrow('Повідомлення не знайдено');
  });

  it('списки й відомість — через звіти; невідомий тип — помилка', async () => {
    const lists = await service.createReportLetter(
      { legalEntityId: 'le1', type: 'LISTS', reportDate: '2026-11-01', date: '2026-11-02' } as never,
      HR,
    );
    expect((await service.document(lists.id)).filename).toBe(`Списки ${lists.number} 2026-11-01.docx`);
    const report = await service.createReportLetter(
      { legalEntityId: 'le1', type: 'OPERATIONAL_REPORT', reportDate: '2026-11-01' } as never,
      HR,
    );
    expect((await service.document(report.id)).filename).toContain('Відомість');
    const other = letters().seed({
      type: 'OTHER',
      number: '1',
      date: '2026-11-01',
      year: 2026,
      sequence: 99,
      params: {},
    } as never)[0];
    await expect(service.document(other.id)).rejects.toThrow('не формується');
  });

  it('витяг для ТЦК без жодної людини — не створюється', async () => {
    reports.lists.mockResolvedValueOnce({ rows: [] });
    await expect(
      service.createReportLetter(
        { legalEntityId: 'le1', type: 'LISTS', reportDate: '2026-11-01', byTck: true, tckId: 't1' } as never,
        HR,
      ),
    ).rejects.toThrow('Витяг не потрібен');
    await expect(
      service.createReportLetter(
        { legalEntityId: 'le1', type: 'LISTS', reportDate: '2026-11-01', byTck: true } as never,
        HR,
      ),
    ).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'tckId' })] },
    });
  });

  it('кілька юросіб — документ потребує вибору юрособи', async () => {
    await expect(service.createReportLetter({ type: 'LISTS', reportDate: '2026-11-01' } as never, HR)).rejects.toThrow(
      'Оберіть юридичну особу',
    );
  });

  it('сформовані списки: лист бере дату і рядки знімка', async () => {
    const letter = await service.createReportLetter(
      { legalEntityId: 'le1', type: 'LISTS', reportDate: '2026-12-31', snapshotId: 's1' } as never,
      HR,
    );
    expect(letter.subject).toContain('01.11.2026');
    expect(letter.params).toMatchObject({ snapshotId: 's1', reportDate: '2026-11-01' });
  });

  it('звірка: супровідний, опис ф107 і весь пакет у zip', async () => {
    const e = w.seedEmployee({
      id: 'e1',
      militaryDocuments: [
        {
          type: 'Електронний військово-обліковий документ',
          number: '',
          sortOrder: 0,
          generatedDate: '2026-01-01',
          generatedTime: '10:00',
        },
      ],
    });
    expect(e.id).toBe('e1');
    const letter = await service.createReportLetter(
      { legalEntityId: 'le1', type: 'LISTS', reportDate: '2026-11-01', tckId: 't1' } as never,
      HR,
    );
    expect((await service.reconciliation(letter.id, 'cover')).filename).toContain('Супровідний лист');
    expect((await service.reconciliation(letter.id, 'inventory')).filename).toContain('Опис вкладення ф107');
    const all = await service.reconciliation(letter.id, 'all');
    const zip = await JSZip.loadAsync(all.buffer);
    expect(Object.keys(zip.files)).toHaveLength(4);
    const notice = letters().seed({
      type: 'OPERATIONAL_REPORT',
      number: '2',
      date: '2026-11-01',
      year: 2026,
      sequence: 98,
      params: {},
    } as never)[0];
    await expect(service.reconciliation(notice.id, 'cover')).rejects.toThrow('лише для листів зі списками');
  });

  it('звірка без людей — не потрібна', async () => {
    reports.lists.mockResolvedValueOnce({ rows: [] });
    const letter = letters().seed({
      type: 'LISTS',
      number: '3',
      date: '2026-11-01',
      year: 2026,
      sequence: 97,
      params: { reportDate: '2026-11-01' },
    } as never)[0];
    await expect(service.reconciliation(letter.id, 'cover')).rejects.toThrow('звірка не потрібна');
  });

  it('опис ф107 і пакет «для пошти» для листа з повідомленнями', async () => {
    const { a } = queue();
    const [letter] = await service.createChangeNotices({ employeeIds: [a.id] }, HR);
    expect((await service.inventory(letter.id)).filename).toContain('ф107');
    const pack = await service.postPackage(letter.id);
    expect(pack.filename).toBe(`Для пошти ${letter.number}.zip`);
    const noTck = letters().seed({
      type: 'OTHER',
      number: '4',
      date: '2026-11-01',
      year: 2026,
      sequence: 96,
      params: {},
    } as never)[0];
    await expect(service.inventory(noTck.id)).rejects.toThrow('Оберіть ТЦК');
  });

  it('наклейки: порожній вибір, чужі листи, одна наклейка з номером', async () => {
    const { a } = queue();
    const [letter] = await service.createChangeNotices({ employeeIds: [a.id] }, HR);
    await expect(service.labels([])).rejects.toThrow('хоча б один');
    await expect(service.labels([letter.id], 'le2')).rejects.toThrow('Деякі листи не знайдено');
    expect((await service.labels([letter.id])).filename).toBe(`Наклейка ${letter.number}.docx`);
    const print = await service.labelPrintData([letter.id]);
    expect(print.groups[0].labels[0].recipient).toBeTruthy();
  });

  it('зафіксований документ: перевірка цілісності й підписи .p7s', async () => {
    const doc = Buffer.from('signed document');
    files.set('doc-key', doc);
    files.set('sig-key', Buffer.from('p7s'));
    const [letter] = letters().seed({
      type: 'OTHER',
      number: '5',
      date: '2026-11-01',
      year: 2026,
      sequence: 95,
      params: {},
      documentKey: 'doc-key',
      documentSha256: sha256(doc),
      documentFilename: 'Лист.docx',
    } as never);
    signatures().seed({ letterId: letter.id, fileKey: 'sig-key', signerName: 'x', certSerial: '1', size: 3 } as never);
    expect((await service.document(letter.id)).filename).toBe('Лист.docx');
    const attachments = await service.signedAttachments(letter.id);
    expect(attachments?.map((x) => x.filename)).toEqual(['Лист.docx', 'Лист.docx.p7s']);
    files.set('doc-key', Buffer.from('tampered'));
    await expect(service.frozenDocument(letter.id)).rejects.toThrow('Цілісність');
    const plain = letters().seed({
      type: 'OTHER',
      number: '6',
      date: '2026-11-01',
      year: 2026,
      sequence: 94,
      params: {},
    } as never)[0];
    await expect(service.frozenDocument(plain.id)).rejects.toThrow('зафіксуйте');
    expect(await service.signedAttachments(plain.id)).toBeNull();
  });

  it('внесене вручну — документа немає', async () => {
    const { a } = queue();
    const letter = await service.createExternalNotice(
      { employeeId: a.id, date: '2026-10-01', number: '7', changeType: 'DATA' } as never,
      HR,
    );
    await expect(service.document(letter.id)).rejects.toThrow('внесено вручну');
  });
});

describe('LettersService.list', () => {
  it('без ключа документа, з позначкою «зафіксовано» і ПІБ працівника', async () => {
    const { a } = queue();
    await service.createChangeNotice({ employeeId: a.id } as never, HR);
    letters().qb({ getMany: () => letters().rows.map((r) => letters().hydrate({ ...r, documentKey: 'k' })) });
    const [row] = await service.list({} as never, 'le1');
    expect(row).not.toHaveProperty('documentKey');
    expect(row.frozen).toBe(true);
    expect(row.employee?.fullName).toContain('Бойко');
  });
});
