import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '../../test/fake-db.js';
import { HR, ORG, person } from '../../test/fixtures.js';
import { AuditService } from '../audit/audit.service.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import type { QuotaWatchService } from '../notifications/quota-watch.service.js';
import type { OrganizationService } from '../organization/organization.service.js';
import type { SecurityService } from '../security/security.service.js';
import type { CreateEmployeeDto, UpdateEmployeeDto } from './employees.dto.js';
import { EmployeesService } from './employees.service.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { EmployeeChange } from './entities/employee-change.entity.js';
import { EmployeeFieldHistory } from './entities/employee-field-history.entity.js';
import { Employee } from './entities/employee.entity.js';
import { MilitaryDocument } from './entities/military-document.entity.js';

let db: FakeDb;
let service: EmployeesService;
let quota: { recalc: ReturnType<typeof vi.fn> };
let security: { checkViews: ReturnType<typeof vi.fn> };

const employees = () => db.getRepository<Employee>(Employee);
const changes = () => db.getRepository<EmployeeChange>(EmployeeChange);
const history = () => db.getRepository<EmployeeFieldHistory>(EmployeeFieldHistory);
const audit = () => db.getRepository<AuditLog>(AuditLog);

beforeEach(() => {
  db = new FakeDb();
  db.getRepository(LegalEntity).seed({
    id: 'le1',
    fullName: 'ТОВ «Вигадана компанія»',
    shortName: 'Вигадана компанія',
  } as never);
  db.getRepository(LegalEntity).seed({ id: 'le2', fullName: 'ТОВ «Друга вигадана»', shortName: '' } as never);
  db.getRepository(Tck).seed(
    {
      id: 't1',
      name: 'Шевченківський РТЦК та СП',
      nameGenitive: 'Шевченківського РТЦК та СП',
      email: 'tck@example.com',
    } as never,
    { id: 't2', name: 'Франківський РТЦК та СП', nameGenitive: '', email: '' } as never,
  );
  quota = { recalc: vi.fn() };
  security = { checkViews: vi.fn() };
  const org = { get: async () => ORG } as unknown as OrganizationService;
  const entities = {
    resolveForEmployee: async (id?: string | null) => id || 'le1',
    get: async (id: string) => ({ id }),
  } as unknown as LegalEntitiesService;
  service = new EmployeesService(
    employees() as never,
    changes() as never,
    audit() as never,
    db.dataSource as never,
    org,
    new AuditService(audit() as never),
    entities,
    security as unknown as SecurityService,
    quota as unknown as QuotaWatchService,
  );
});

const seedEmployee = (over: Record<string, unknown> = {}) => employees().seed(person(over) as never)[0];

describe('EmployeesService.create', () => {
  it('нова картка: ПІБ з великої, телефон нормалізовано, у черзі — повідомлення про прийняття', async () => {
    const created = await service.create(
      person({
        lastName: '  вигаданий ',
        firstName: 'петро',
        phone: '0671234567',
        hireOrderNumber: '12-к',
        hireOrderDate: '2026-11-20',
        hireDate: '2026-11-20',
      }) as unknown as CreateEmployeeDto,
      HR,
    );
    expect(created.lastName).toBe('Вигаданий');
    expect(created.firstName).toBe('Петро');
    expect(created.phone).toMatch(/^\+380/);
    const queue = changes().rows;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      type: 'HIRE',
      newValue: 'Інженер',
      effectiveDate: '2026-11-20',
      createdById: 'u-hr',
    });
    expect(queue[0].basis).toContain('№ 12-к');
    expect(audit().rows.some((r) => r.action === 'CREATE')).toBe(true);
    expect(quota.recalc).toHaveBeenCalledWith(['le1'], expect.stringContaining('Прийнято'));
  });

  it('посада з картки стає першим записом у «Посадах», освіта — першим документом', async () => {
    const created = await service.create(
      person({
        educationLevel: 'Вища',
        educationSpecialty: 'Математика',
        positions: undefined,
        educations: undefined,
      }) as unknown as CreateEmployeeDto,
      HR,
    );
    expect(created.positions).toHaveLength(1);
    expect(created.positions[0]).toMatchObject({ position: 'Інженер', since: '2020-01-01' });
    expect(created.educations[0]).toMatchObject({ level: 'Вища', specialty: 'Математика' });
  });

  it('звільнений у картці одразу — два повідомлення: прийняття і звільнення', async () => {
    await service.create(
      person({ dismissalDate: '2026-11-01', dismissalOrderNumber: '5' }) as unknown as CreateEmployeeDto,
      HR,
    );
    expect(
      changes()
        .rows.map((c) => c.type)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(['DISMISSAL', 'HIRE']);
    expect(changes().rows.find((c) => c.type === 'DISMISSAL')?.basis).toContain('наказ про звільнення № 5');
  });

  it('військові документи: порожні відкинуто, у паперових серія великими, в електронних номера немає', async () => {
    const created = await service.create(
      person({
        militaryDocuments: [
          { type: 'Військовий квиток', series: 'аа', number: ' 123 ', issuedBy: 'Шевченківський РТЦК та СП' },
          { type: '', series: '', number: '' },
          {
            type: 'Електронний військово-обліковий документ',
            series: 'XX',
            number: '1',
            generatedDate: '2026-01-01',
            generatedTime: ' 10:00 ',
          },
        ],
      }) as unknown as CreateEmployeeDto,
      HR,
    );
    const docs = db.getRepository<MilitaryDocument>(MilitaryDocument).rows;
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ series: 'АА', number: '123', employeeId: created.id, sortOrder: 0 });
    expect(docs[1]).toMatchObject({ series: '', number: '', generatedTime: '10:00' });
  });
});

describe('EmployeesService.createMany (імпорт)', () => {
  it('RECENT: повідомлення лише про недавно прийнятих; квоту перераховано один раз', async () => {
    const result = await service.createMany(
      [
        person({ lastName: 'Давній', hireDate: '2015-03-01' }) as unknown as CreateEmployeeDto,
        person({ lastName: 'Новий', hireDate: new Date().toISOString().slice(0, 10) }) as unknown as CreateEmployeeDto,
      ],
      HR,
      { hireNotices: 'RECENT', source: 'file' },
    );
    expect(result.ids).toHaveLength(2);
    expect(result.notices).toBe(1);
    expect(db.transactions).toBe(1);
    expect(quota.recalc).toHaveBeenCalledTimes(1);
    expect(quota.recalc.mock.calls[0][1]).toBe('Додано працівників: 2');
    expect(
      audit()
        .rows.filter((r) => r.action === 'CREATE')
        .every((r) => r.diff.source),
    ).toBe(true);
  });

  it('NONE — без жодного повідомлення; ALL — про всіх', async () => {
    const none = await service.createMany([person() as unknown as CreateEmployeeDto], HR, {
      hireNotices: 'NONE',
      source: 'файл',
    });
    expect(none.notices).toBe(0);
    const all = await service.createMany([person({ hireDate: '2001-01-01' }) as unknown as CreateEmployeeDto], HR, {
      hireNotices: 'ALL',
      source: 'файл',
    });
    expect(all.notices).toBe(1);
  });
});

describe('EmployeesService.update', () => {
  it('зміна телефону й адреси: історія з датою, повідомлення ТЦК — лише про адресу', async () => {
    const e = seedEmployee({ phone: '+380501111111' });
    await service.update(
      e.id,
      {
        phone: '+380502222222',
        actualAddress: 'м. Тестове, вул. Нова, 2',
        changeMeta: { effectiveDate: '2026-11-15', basis: 'заява' },
      } as unknown as UpdateEmployeeDto,
      HR,
    );
    const rows = history().rows;
    expect(rows.map((r) => r.field).sort((a, b) => a.localeCompare(b))).toEqual(['actualAddress', 'phone']);
    expect(rows.find((r) => r.field === 'phone')).toMatchObject({
      oldValue: '+380501111111',
      newValue: '+380502222222',
      effectiveDate: '2026-11-15',
      basis: 'заява',
    });
    expect(changes().rows.map((c) => c.type)).toEqual(['ACTUAL_ADDRESS']);
  });

  it('«не повідомляти»: зміна в історії, але в черзі ТЦК позначена пропущеною', async () => {
    const e = seedEmployee();
    await service.update(
      e.id,
      { registeredAddress: 'м. Тестове, вул. Інша, 3', changeMeta: { notify: false } } as unknown as UpdateEmployeeDto,
      HR,
    );
    expect(changes().rows).toHaveLength(1);
    expect(changes().rows[0].skipped).toBe(true);
    expect(history().rows[0].field).toBe('registeredAddress');
  });

  it('новий паспорт → повідомлення PASSPORT і запис історії паспорта', async () => {
    const e = seedEmployee();
    await service.update(
      e.id,
      { passportNumber: '000000002', passportIssuedAt: '2026-11-01' } as unknown as UpdateEmployeeDto,
      HR,
    );
    expect(changes().rows.map((c) => c.type)).toEqual(['PASSPORT']);
    const row = history().rows.find((r) => r.field === 'passport');
    expect(row?.oldValue).toContain('000000001');
    expect(row?.newValue).toContain('000000002');
  });

  it('зміна ТЦК: історія зберігає назву й дату обліку попереднього', async () => {
    const e = seedEmployee({ tckId: 't1', tckRegisteredAt: '2020-02-01' });
    await service.update(e.id, { tckId: 't2', tckRegisteredAt: '2026-11-10' } as unknown as UpdateEmployeeDto, HR);
    expect(history().rows.find((r) => r.field === 'tck')).toMatchObject({
      oldValue: 'Шевченківський РТЦК та СП',
      newValue: 'Франківський РТЦК та СП',
      effectiveDate: '2026-11-10',
      oldEffectiveDate: '2020-02-01',
    });
    expect(employees().rows[0].tckId).toBe('t2');
  });

  it('повернення до старого значення прибирає ще не надіслане повідомлення', async () => {
    const e = seedEmployee();
    await service.update(e.id, { lastName: 'Змінений' } as unknown as UpdateEmployeeDto, HR);
    expect(changes().rows).toHaveLength(1);
    await service.update(e.id, { lastName: 'Вигаданий' } as unknown as UpdateEmployeeDto, HR);
    expect(changes().rows).toHaveLength(0);
  });

  it('друга зміна того ж типу до надсилання — оновлює чернетку, а не дублює', async () => {
    const e = seedEmployee();
    await service.update(e.id, { lastName: 'Перший' } as unknown as UpdateEmployeeDto, HR);
    await service.update(
      e.id,
      { lastName: 'Другий', changeMeta: { basis: 'свідоцтво' } } as unknown as UpdateEmployeeDto,
      HR,
    );
    expect(changes().rows).toHaveLength(1);
    expect(changes().rows[0]).toMatchObject({ oldValue: 'Вигаданий', newValue: 'Другий', basis: 'свідоцтво' });
  });

  it('дата звільнення раніша за прийняття — помилка біля поля, нічого не збережено', async () => {
    const e = seedEmployee();
    await expect(
      service.update(e.id, { dismissalDate: '2019-01-01' } as unknown as UpdateEmployeeDto, HR),
    ).rejects.toMatchObject({ response: { errors: [expect.objectContaining({ field: 'dismissalDate' })] } });
  });

  it('звільнення через редагування — повідомлення DISMISSAL і перерахунок квоти', async () => {
    const e = seedEmployee({ reserved: true, reservationUntil: '2026-12-31' });
    await service.update(e.id, { dismissalDate: '2026-11-20' } as unknown as UpdateEmployeeDto, HR);
    expect(changes().rows.map((c) => c.type)).toContain('DISMISSAL');
    expect(quota.recalc).toHaveBeenCalled();
  });

  it('у журналі — лише змінені поля', async () => {
    const e = seedEmployee();
    await service.update(e.id, { position: 'Інженер', department: 'Відділ Б' } as unknown as UpdateEmployeeDto, HR);
    const log = audit().rows.find((r) => r.action === 'UPDATE');
    expect(Object.keys(log?.diff ?? {})).toEqual(['department']);
  });
});

describe('EmployeesService.dismiss / remove', () => {
  it('звільнення: дата, наказ, повідомлення з підставою', async () => {
    const e = seedEmployee();
    const out = await service.dismiss(
      e.id,
      {
        dismissalDate: '2026-11-20',
        dismissalOrderNumber: '77',
        dismissalOrderDocName: 'Наказ',
        dismissalOrderDate: '2026-11-19',
      },
      HR,
    );
    expect(out.dismissalDate).toBe('2026-11-20');
    expect(changes().rows[0]).toMatchObject({ type: 'DISMISSAL', oldValue: 'Інженер' });
    expect(changes().rows[0].basis).toContain('Наказ про звільнення № 77');
    expect(quota.recalc).toHaveBeenCalledWith(['le1'], expect.stringContaining('Звільнено'));
  });

  it('повторне звільнення і дата до прийняття — відмова', async () => {
    const e = seedEmployee({ dismissalDate: '2026-01-01' });
    await expect(service.dismiss(e.id, { dismissalDate: '2026-11-20' }, HR)).rejects.toThrow('вже звільнено');
    const f = seedEmployee();
    await expect(service.dismiss(f.id, { dismissalDate: '2019-01-01' }, HR)).rejects.toThrow('раніша');
  });

  it('видалення картки — запис у журналі й перерахунок квоти', async () => {
    const e = seedEmployee();
    await service.remove(e.id, HR);
    expect(employees().rows).toHaveLength(0);
    expect(audit().rows.at(-1)).toMatchObject({ action: 'DELETE' });
    expect(quota.recalc).toHaveBeenCalledWith(['le1'], 'Видалено картку працівника');
  });

  it('неіснуючий працівник — «не знайдено»', async () => {
    await expect(service.get('nope')).rejects.toThrow('Працівника не знайдено');
  });
});

describe('EmployeesService.get / list', () => {
  it('картка: перегляд у журналі, перевірка підозрілих переглядів, історія полів', async () => {
    const e = seedEmployee();
    history().seed({
      employeeId: e.id,
      field: 'phone',
      oldValue: '1',
      newValue: '2',
      effectiveDate: '2026-11-01',
      basis: '',
    } as never);
    const card = await service.get(e.id, HR);
    expect(card.fieldHistory).toHaveLength(1);
    expect(audit().rows.some((r) => r.action === 'VIEW')).toBe(true);
    expect(security.checkViews).toHaveBeenCalledWith(HR);
  });

  it('список: звільнений з листом SENT, з чернеткою — IN_LETTER, без листа — PENDING з терміном', async () => {
    const letters = db.getRepository(OutgoingLetter);
    const [sent] = letters.seed({ id: 'l1', number: '15', status: 'SENT' } as never);
    const [draft] = letters.seed({ id: 'l2', number: '16', status: 'DRAFT' } as never);
    const a = seedEmployee({ lastName: 'А', dismissalDate: '2026-10-01' });
    const b = seedEmployee({ lastName: 'Б', dismissalDate: '2026-10-02' });
    const c = seedEmployee({ lastName: 'В', dismissalDate: '2026-10-03' });
    seedEmployee({ lastName: 'Г' });
    changes().seed(
      { employeeId: a.id, type: 'DISMISSAL', effectiveDate: '2026-10-01', letterId: sent.id } as never,
      { employeeId: b.id, type: 'DISMISSAL', effectiveDate: '2026-10-02', letterId: draft.id } as never,
      { employeeId: c.id, type: 'DISMISSAL', effectiveDate: '2026-10-03' } as never,
    );
    employees().qb({ getMany: () => employees().rows.map((r) => employees().hydrate({ ...r })) });
    changes().qb({ getRawMany: [{ employeeId: c.id, count: 1 }] });
    const { items, total } = await service.list({ status: 'all' } as never);
    expect(total).toBe(4);
    const byName = Object.fromEntries(items.map((i) => [i.lastName, i]));
    expect(byName['А'].dismissalNotice).toMatchObject({ status: 'SENT', letterNumber: '15' });
    expect(byName['Б'].dismissalNotice).toMatchObject({ status: 'IN_LETTER', letterNumber: '16' });
    expect(byName['В'].dismissalNotice?.status).toBe('PENDING');
    expect(byName['В'].dismissalNotice?.deadline).toBeTruthy();
    expect(byName['В'].pendingChanges).toBe(1);
    expect(byName['Г'].dismissalNotice).toBeNull();
    expect(byName['А'].legalEntityName).toBe('Вигадана компанія');
  });

  it('фільтр «з попередженнями» лишає тих, у кого є незвітовані зміни', async () => {
    const a = seedEmployee({ lastName: 'А' });
    seedEmployee({ lastName: 'Б' });
    employees().qb({ getMany: () => employees().rows.map((r) => employees().hydrate({ ...r })) });
    changes().qb({ getRawMany: [{ employeeId: a.id, count: 2 }] });
    const { items } = await service.list({ withWarnings: 'true' } as never);
    expect(items.map((i) => i.lastName)).toContain('А');
  });
});

describe('EmployeesService: черга змін для ТЦК', () => {
  it('pendingChanges: працівник з ТЦК у родовому відмінку і юрособою', async () => {
    const e = seedEmployee({ tckId: 't1', middleName: '' });
    changes().seed({
      employeeId: e.id,
      type: 'LAST_NAME',
      oldValue: 'А',
      newValue: 'Б',
      effectiveDate: '2026-11-01',
    } as never);
    const [c] = await service.pendingChanges();
    expect(c.employee).toMatchObject({
      fullName: 'Вигаданий Петро',
      tckNameGenitive: 'Шевченківського РТЦК та СП',
      tckEmail: 'tck@example.com',
      legalEntityName: 'Вигадана компанія',
    });
    expect(c.typeLabel).toBeTruthy();
  });

  it('pendingChanges: чужа юрособа не видна; без родового — назва', async () => {
    const e = seedEmployee({ tckId: 't2', legalEntityId: 'le2' });
    changes().seed({ employeeId: e.id, type: 'LAST_NAME', effectiveDate: '2026-11-01' } as never);
    expect(await service.pendingChanges('le1')).toHaveLength(0);
    const [c] = await service.pendingChanges('le2');
    expect(c.employee.tckNameGenitive).toBe('Франківський РТЦК та СП');
    expect(c.employee.legalEntityName).toBe('ТОВ «Друга вигадана»');
  });

  it('updateChange: можна правити лише ще не включену до листа', async () => {
    const e = seedEmployee();
    const [free, sent] = changes().seed(
      { employeeId: e.id, type: 'LAST_NAME', effectiveDate: '2026-11-01' } as never,
      { employeeId: e.id, type: 'FIRST_NAME', effectiveDate: '2026-11-01', letterId: 'l9' } as never,
    );
    const saved = await service.updateChange(free.id, { basis: 'свідоцтво' } as never);
    expect(saved.basis).toBe('свідоцтво');
    await expect(service.updateChange(sent.id, { basis: 'x' } as never)).rejects.toThrow('включена до листа');
    await expect(service.updateChange(free.id, { basis: 'x' } as never, 'le2')).rejects.toThrow('Зміну не знайдено');
  });
});

describe('EmployeesService: доступ за юрособою', () => {
  it('assertAccess: своя — так, чужа — «не знайдено», адміністратор — усі', async () => {
    const e = seedEmployee();
    await expect(service.assertAccess(e.id, 'le1')).resolves.toBeUndefined();
    await expect(service.assertAccess(e.id, 'le2')).rejects.toThrow('Працівника не знайдено');
    await expect(service.assertAccess(e.id, null)).resolves.toBeUndefined();
  });

  it('assertAccessMany: хоч один чужий — відмова', async () => {
    const a = seedEmployee();
    const b = seedEmployee({ legalEntityId: 'le2' });
    await expect(service.assertAccessMany([a.id, a.id], 'le1')).resolves.toBeUndefined();
    await expect(service.assertAccessMany([a.id, b.id], 'le1')).rejects.toThrow('Працівника не знайдено');
    await expect(service.assertAccessMany([], 'le1')).resolves.toBeUndefined();
  });
});

describe('EmployeesService: новий ТЦК підтягується в картки', () => {
  it('tckMatches: лише працюючі без ТЦК, у чиєму документі цей ТЦК', async () => {
    const issued = {
      type: 'Військовий квиток',
      number: '1',
      issuedBy: 'Шевченківським РТЦК та СП м. Києва',
      sortOrder: 0,
    };
    const a = seedEmployee({ lastName: 'А', militaryDocuments: [{ ...issued }] });
    seedEmployee({ lastName: 'Б', militaryDocuments: [{ ...issued }], tckId: 't2' });
    seedEmployee({ lastName: 'В', militaryDocuments: [{ ...issued }], dismissalDate: '2020-01-01' });
    seedEmployee({ lastName: 'Г', militaryDocuments: [{ ...issued, issuedBy: 'Інший ТЦК' }] });
    const found = await service.tckMatches('t1');
    expect(found).toEqual([{ id: a.id, fullName: 'А Петро Іванович', issuedBy: issued.issuedBy }]);
    await expect(service.tckMatches('nope')).rejects.toThrow('ТЦК не знайдено');
  });

  it('assignTck: призначає лише тим, кого запропоновано', async () => {
    const issued = { type: 'Військовий квиток', number: '1', issuedBy: 'Шевченківським РТЦК та СП', sortOrder: 0 };
    const a = seedEmployee({ militaryDocuments: [{ ...issued }] });
    const other = seedEmployee({ legalEntityId: 'le2' });
    const out = await service.assignTck('t1', [a.id, other.id], HR, 'le1');
    expect(out).toEqual({ assigned: 1 });
    expect(employees().rows.find((r) => r.id === a.id)?.tckId).toBe('t1');
    expect(history().rows.some((r) => r.field === 'tck')).toBe(true);
  });
});

describe('EmployeesService.auditTrail', () => {
  it('історія картки з назвами ТЦК і юросіб замість id', async () => {
    const e = seedEmployee();
    audit().seed({
      entity: 'employee',
      entityId: e.id,
      action: 'UPDATE',
      diff: { tckId: [null, 't1'] },
      userName: 'Кадровик Вигаданий',
      createdAt: new Date('2026-11-01T10:00:00Z'),
    } as never);
    const rows = await service.auditTrail(e.id);
    expect(JSON.stringify(rows)).toContain('Шевченківський РТЦК та СП');
  });
});
