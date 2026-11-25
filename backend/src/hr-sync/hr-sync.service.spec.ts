import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN } from '../../test/fixtures.js';
import { wire } from '../../test/wiring.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { SecurityService } from '../security/security.service.js';
import type { SubscriptionGateService } from '../subscriptions/subscription-gate.service.js';
import { HrSyncBatch } from './entities/hr-sync-batch.entity.js';
import { HrSyncSettings } from './entities/hr-sync-settings.entity.js';
import { HrSyncService, kyivHour } from './hr-sync.service.js';
import { ODataError, OneCODataClient } from './odata/one-c-odata.client.js';

let w: ReturnType<typeof wire>;
let gate: { gate: ReturnType<typeof vi.fn> };
let record: ReturnType<typeof vi.fn>;
let service: HrSyncService;
const settings = () => w.db.getRepository<HrSyncSettings>(HrSyncSettings);
const batches = () => w.db.getRepository<HrSyncBatch>(HrSyncBatch);
const employees = () => w.db.getRepository<Employee>(Employee);

const DTO = {
  system: 'ZUP',
  mode: 'PUSH',
  frequency: 'ONGOING',
  scheduleEnabled: false,
  scheduleHour: 6,
  autoApply: true,
  militaryPolicy: 'FILL_EMPTY',
  importDismissed: false,
} as const;

/** Fictional people as 1C sends them. */
const PEOPLE = [
  {
    lastName: 'Вигаданий',
    firstName: 'Петро',
    middleName: 'Іванович',
    gender: 'M',
    birthDate: '1990-01-01',
    position: 'Інженер',
    hireDate: '2020-01-01',
    personnelNumber: '007',
  },
  {
    lastName: 'Тестова',
    firstName: 'Олена',
    middleName: 'Петрівна',
    gender: 'F',
    birthDate: '1992-02-02',
    position: 'Бухгалтер',
    hireDate: '2021-03-01',
    personnelNumber: '008',
  },
];

beforeEach(() => {
  w = wire();
  gate = { gate: vi.fn(async () => 'OK') };
  record = vi.fn();
  service = new HrSyncService(
    settings() as never,
    batches() as never,
    employees() as never,
    w.db.getRepository(Tck) as never,
    w.db.getRepository(LegalEntity) as never,
    w.employees,
    gate as unknown as SubscriptionGateService,
    { record } as unknown as SecurityService,
  );
});
afterEach(() => vi.restoreAllMocks());

async function pushKey(over: Record<string, unknown> = {}) {
  await service.save('le1', { ...DTO, ...over } as never, ADMIN);
  const { token } = await service.issueToken('le1', ADMIN);
  return `Bearer ${token}`;
}

describe('HrSyncService: налаштування', () => {
  it('без налаштувань — типовий вигляд; збереження й ключ (показано один раз, у вигляді — лише префікс)', async () => {
    expect((await service.view('le1')).configured).toBe(false);
    const view = await service.save('le1', { ...DTO, pushAllowedIps: '10.0.0.1, 10.0.0.2' } as never, ADMIN);
    expect(view).toMatchObject({ configured: true, mode: 'PUSH', pushAllowedIps: '10.0.0.1, 10.0.0.2' });
    const { token, settings: s } = await service.issueToken('le1', ADMIN, 30);
    expect(token.startsWith(s.tokenPrefix)).toBe(true);
    expect(JSON.stringify(s)).not.toContain(token);
    expect(s.tokenExpiresAt).toBeTruthy();
    expect((await service.revokeToken('le1')).tokenPrefix).toBe('');
    expect(service.label(view)).toContain('надсилання з 1С');
  });

  it('OData: лише для 1С, потрібні адреса, користувач і пароль, лише https', async () => {
    await expect(service.save('le1', { ...DTO, mode: 'ODATA', system: 'OTHER' } as never, ADMIN)).rejects.toThrow(
      'лише для баз 1С',
    );
    await expect(service.save('le1', { ...DTO, mode: 'ODATA' } as never, ADMIN)).rejects.toThrow('вкажіть адресу');
    // production rules: no plain http (development allows a 1C server in the local network)
    const env = (service as unknown as { env: object }).env;
    (service as unknown as { env: object }).env = { ...env, allowPrivateDbHosts: false };
    await expect(
      service.save(
        'le1',
        { ...DTO, mode: 'ODATA', odataUrl: 'http://1c.example.com/base', odataUser: 'u', odataPassword: 'p' } as never,
        ADMIN,
      ),
    ).rejects.toThrow('https://');
    const ok = await service.save(
      'le1',
      {
        ...DTO,
        mode: 'ODATA',
        odataUrl: 'https://1c.example.com/base',
        odataUser: 'u',
        odataPassword: 'p',
        scheduleEnabled: true,
      } as never,
      ADMIN,
    );
    expect(ok).toMatchObject({ hasOdataPassword: true, scheduleEnabled: true });
    expect(JSON.stringify(ok)).not.toContain('"p"');
  });

  it('невідома юрособа; вимкнення стирає налаштування й історію', async () => {
    await expect(service.view('nope')).rejects.toThrow('Юрособу не знайдено');
    await pushKey();
    await service.remove('le1');
    expect(settings().rows).toHaveLength(0);
    await expect(service.reopen('le1')).rejects.toThrow('ще не налаштовано');
  });
});

describe('HrSyncService.receivePush — дані з 1С', () => {
  it('ключ і адреса правильні — нові картки одразу (autoApply), у журналі «інтеграція з 1С»', async () => {
    const auth = await pushKey();
    const res = await service.receivePush(auth, '10.0.0.1', { employees: PEOPLE });
    expect(res).toMatchObject({ received: 2, status: 'APPLIED' });
    expect(
      employees()
        .rows.map((e) => e.lastName)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(['Вигаданий', 'Тестова']);
    expect(settings().rows[0].lastStatus).toBe('APPLIED');
    const again = await service.receivePush(auth, '10.0.0.1', { employees: PEOPLE });
    expect(again.counts.create).toBe(0);
  });

  it('без autoApply — чекає на перегляд; застосувати двічі не можна; відхилити', async () => {
    const auth = await pushKey({ autoApply: false });
    const res = await service.receivePush(auth, '10.0.0.1', { employees: PEOPLE });
    expect(res.status).toBe('PENDING');
    expect(employees().rows).toHaveLength(0);
    const applied = await service.apply('le1', res.batchId, ADMIN);
    expect(applied.status).toBe('APPLIED');
    expect(employees().rows).toHaveLength(2);
    await expect(service.apply('le1', res.batchId, ADMIN)).rejects.toThrow('вже оброблено');
    const second = await service.receivePush(auth, '10.0.0.1', {
      employees: [{ ...PEOPLE[0], position: 'Старший інженер' }],
    });
    const discarded = await service.discard('le1', second.batchId, ADMIN);
    expect(discarded.status).toBe('DISCARDED');
    await expect(service.discard('le1', second.batchId, ADMIN)).rejects.toThrow('вже оброблено');
    expect((await service.history('le1')).length).toBe(2);
    expect((await service.batch('le1', res.batchId)).items.length).toBe(2);
    await expect(service.batch('le1', 'nope')).rejects.toThrow('Отримання не знайдено');
  });

  it('зміна посади з 1С — через картку: повідомлення ТЦК у черзі', async () => {
    const auth = await pushKey();
    await service.receivePush(auth, '10.0.0.1', { employees: PEOPLE });
    w.db.getRepository(EmployeeChange).rows.length = 0;
    await service.receivePush(auth, '10.0.0.1', {
      employees: [{ ...PEOPLE[0], position: 'Старший інженер' }, PEOPLE[1]],
    });
    expect(employees().rows.find((e) => e.lastName === 'Вигаданий')?.position).toBe('Старший інженер');
    expect(w.db.getRepository(EmployeeChange).rows.map((c) => c.type)).toContain('POSITION');
  });

  it('хибний ключ, прострочений ключ, чужа адреса, вимкнений прийом, неактивна підписка', async () => {
    await expect(service.receivePush('Bearer nope', '10.0.0.1', { employees: PEOPLE })).rejects.toThrow(
      'Невірний або відкликаний ключ',
    );
    const auth = await pushKey({ pushAllowedIps: '10.0.0.1' });
    await expect(service.ping(auth, '10.9.9.9')).rejects.toThrow('не входить до дозволених');
    expect(record).toHaveBeenCalledWith('HR_PUSH_DENIED', expect.anything(), { reason: 'адреса не дозволена' });
    gate.gate.mockResolvedValueOnce('EXPIRED');
    await expect(service.ping(auth, '10.0.0.1')).rejects.toThrow('Підписка юрособи неактивна');
    expect(await service.ping(auth, '10.0.0.1')).toEqual({
      ok: true,
      legalEntity: 'ТОВ «Вигадана компанія»',
      edrpou: '12345678',
    });
    settings().rows[0].tokenExpiresAt = new Date(Date.now() - 1000);
    await expect(service.ping(auth, '10.0.0.1')).rejects.toThrow('Строк дії ключа минув');
    settings().rows[0].tokenExpiresAt = null;
    settings().rows[0].mode = 'ODATA';
    await expect(service.ping(auth, '10.0.0.1')).rejects.toThrow('прийом даних з 1С вимкнено');
  });

  it('хибне тіло — 400 з поясненням', async () => {
    const auth = await pushKey();
    await expect(service.receivePush(auth, '10.0.0.1', {})).rejects.toThrow();
  });

  it('разове завантаження: після отримання — ключ більше не діє; «Отримати ще раз» відкриває знову', async () => {
    const auth = await pushKey({ frequency: 'ONCE' });
    await service.receivePush(auth, '10.0.0.1', { employees: PEOPLE });
    expect(settings().rows[0].completedAt).toBeInstanceOf(Date);
    settings().rows[0].firstPushAt = new Date(Date.now() - 7 * 24 * 3600_000);
    await expect(service.receivePush(auth, '10.0.0.1', { employees: PEOPLE })).rejects.toThrow('разове завантаження');
    expect(settings().rows[0].tokenHash).toBe('');
    const view = await service.reopen('le1');
    expect(view.completedAt).toBeNull();
  });
});

describe('HrSyncService: OData', () => {
  async function odata(over: Record<string, unknown> = {}) {
    await service.save(
      'le1',
      {
        ...DTO,
        mode: 'ODATA',
        odataUrl: 'https://1c.example.com/base',
        odataUser: 'u',
        odataPassword: 'p',
        scheduleEnabled: true,
        ...over,
      } as never,
      ADMIN,
    );
  }
  const profile = { profile: { title: 'ЗУП 3.1' }, missing: [], fields: {} };

  it('check: з’єднання є — організації й кількість працюючих; помилка 1С — повідомлення', async () => {
    await odata();
    vi.spyOn(OneCODataClient.prototype, 'profile').mockResolvedValue(profile as never);
    vi.spyOn(OneCODataClient.prototype, 'organizations').mockResolvedValue([
      { ref: 'r', code: '12345678', name: 'Вигадана' },
    ]);
    vi.spyOn(OneCODataClient.prototype, 'employees').mockResolvedValue([
      ...PEOPLE,
      { ...PEOPLE[0], dismissalDate: '2026-01-01' },
    ] as never);
    const ok = await service.check('le1');
    expect(ok).toMatchObject({ ok: true, detected: 'ЗУП 3.1', employees: 2 });
    vi.spyOn(OneCODataClient.prototype, 'profile').mockRejectedValue(new ODataError('Невірний пароль 1С'));
    expect(await service.check('le1')).toMatchObject({ ok: false, message: 'Невірний пароль 1С' });
  });

  it('pull: пакет з даних 1С; порожньо чи помилка — FAILED у налаштуваннях', async () => {
    await odata();
    vi.spyOn(OneCODataClient.prototype, 'profile').mockResolvedValue(profile as never);
    const read = vi.spyOn(OneCODataClient.prototype, 'employees').mockResolvedValue(PEOPLE as never);
    const batch = await service.pull('le1', 'ODATA_MANUAL', ADMIN);
    expect(batch.status).toBe('APPLIED');
    read.mockResolvedValueOnce([]);
    await expect(service.pull('le1', 'ODATA_MANUAL', ADMIN)).rejects.toThrow('не знайдено працівників');
    expect(settings().rows[0].lastStatus).toBe('FAILED');
    read.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(service.pull('le1', 'ODATA_MANUAL', ADMIN)).rejects.toThrow('Не вдалося прочитати дані з 1С');
  });

  it('pull без OData — помилка; runScheduled читає лише в свою годину й з активною підпискою', async () => {
    await pushKey();
    await expect(service.pull('le1', 'ODATA_MANUAL')).rejects.toThrow('оберіть спосіб «OData»');
    await odata({ scheduleHour: 7 });
    vi.spyOn(OneCODataClient.prototype, 'profile').mockResolvedValue(profile as never);
    vi.spyOn(OneCODataClient.prototype, 'employees').mockResolvedValue(PEOPLE as never);
    expect(await service.runScheduled(5)).toEqual({ read: 0, failed: 0 });
    expect(await service.runScheduled(7)).toEqual({ read: 1, failed: 0 });
    gate.gate.mockResolvedValue('EXPIRED');
    expect(await service.runScheduled()).toEqual({ read: 0, failed: 0 });
  });

  it('purge: старі отримання видаляються', async () => {
    const auth = await pushKey({ autoApply: false });
    await service.receivePush(auth, '10.0.0.1', { employees: PEOPLE });
    batches().rows[0].receivedAt = new Date('2000-01-01');
    expect(await service.purge()).toBe(1);
  });

  it('kyivHour — година за Києвом', () => {
    expect(kyivHour(new Date('2026-07-01T09:30:00Z'))).toBe(12);
  });
});
