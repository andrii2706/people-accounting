import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wire } from '../../test/wiring.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { User } from '../users/user.entity.js';
import { LegalEntity } from './legal-entity.entity.js';

let w: ReturnType<typeof wire>;
const entities = () => w.db.getRepository<LegalEntity>(LegalEntity);

beforeEach(() => {
  w = wire();
});
afterEach(() => vi.unstubAllGlobals());

describe('LegalEntitiesService: створення й редагування', () => {
  it('create: поля без пробілів, телефони нормалізовано, порожні дати квоти — null', async () => {
    const created = await w.legalEntities.create({
      fullName: '  ТОВ «Третя вигадана» ',
      shortName: 'Третя',
      edrpou: '11112222',
      phone: '0441234567',
      responsiblePhone: '0501234567',
      reservationQuotaDocDate: '',
      reservationQuotaValidUntil: '',
    } as never);
    expect(created.fullName).toBe('ТОВ «Третя вигадана»');
    expect(created.phone).toMatch(/^\+380/);
    expect(created.responsiblePhone).toMatch(/^\+380/);
    expect(created.reservationQuotaDocDate).toBeNull();
    expect(created.reservationQuotaValidUntil).toBeNull();
  });

  it('код ЄДРПОУ унікальний: при створенні й при зміні коду', async () => {
    await expect(w.legalEntities.create({ fullName: 'x', edrpou: '12345678' } as never)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'edrpou' })] },
    });
    await expect(w.legalEntities.update('le2', { edrpou: '12345678' } as never)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'edrpou' })] },
    });
    const same = await w.legalEntities.update('le1', { edrpou: '12345678', shortName: ' Нова назва ' } as never);
    expect(same.shortName).toBe('Нова назва');
  });

  it('remove: з працівниками (і звільненими) — ні; порожню — так', async () => {
    w.seedEmployee({ legalEntityId: 'le1', dismissalDate: '2020-01-01' });
    await expect(w.legalEntities.remove('le1')).rejects.toThrow('1 працівник');
    await w.legalEntities.remove('le2');
    expect(entities().rows.map((e) => e.id)).toEqual(['le1']);
    await expect(w.legalEntities.get('le2')).rejects.toThrow('Юридичну особу не знайдено');
  });
});

describe('LegalEntitiesService: вибір юрособи', () => {
  it('resolveForEmployee: задана — вона; кілька без вибору — помилка біля поля; одна — вона сама', async () => {
    expect(await w.legalEntities.resolveForEmployee('le2')).toBe('le2');
    await expect(w.legalEntities.resolveForEmployee(null)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'legalEntityId', message: 'Оберіть юридичну особу' })] },
    });
    await w.legalEntities.remove('le2');
    expect(await w.legalEntities.resolveForEmployee(undefined)).toBe('le1');
    await w.legalEntities.remove('le1');
    await expect(w.legalEntities.resolveForEmployee(null)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ message: expect.stringContaining('Спершу додайте') })] },
    });
  });

  it('forDocument: кілька — потрібен вибір; одна — вона; жодної — null', async () => {
    await expect(w.legalEntities.forDocument(null)).rejects.toThrow('Оберіть юридичну особу');
    expect(await w.legalEntities.forDocument('le1')).toBe('le1');
    await w.legalEntities.remove('le2');
    expect(await w.legalEntities.forDocument(null)).toBe('le1');
    await w.legalEntities.remove('le1');
    expect(await w.legalEntities.forDocument(null)).toBeNull();
  });
});

describe('LegalEntitiesService: реквізити для документів', () => {
  it('requisites: юрособа поверх загальних налаштувань', async () => {
    const org = await w.legalEntities.requisites('le1');
    expect(org).toMatchObject({ edrpou: '12345678', letterNumberPrefix: 'ВО-', notifyDeadlineDays: 7 });
  });

  it('responsible: ПІБ, посада, телефон; без ПІБ — null', async () => {
    expect(await w.legalEntities.responsible('le1')).toEqual({
      fullName: 'Відповідальна Тестова',
      position: 'Інспектор',
      phone: '+380500000000',
    });
    expect(await w.legalEntities.responsible('le2')).toBeNull();
  });

  it('наклейки й бланк: типові значення, збереження з «до/після»', async () => {
    const labels = await w.legalEntities.labelSettings('le1');
    expect(labels).toBeTruthy();
    const { before, after } = await w.legalEntities.saveLabelSettings('le1', { ...labels, declaredValue: 25 } as never);
    expect(before.declaredValue).not.toBe(25);
    expect(after.declaredValue).toBe(25);
    const head = await w.legalEntities.letterheadSettings('le1');
    const saved = await w.legalEntities.saveLetterheadSettings('le1', head);
    expect(saved.after).toEqual(head);
    const req = await w.legalEntities.letterheadRequisites('le1');
    expect(req).toMatchObject({ edrpou: '12345678', postalCode: '01001' });
  });

  it('наклейка, що не вміщається на папір, — помилки біля полів', async () => {
    const labels = await w.legalEntities.labelSettings('le1');
    await expect(
      w.legalEntities.saveLabelSettings('le1', { ...labels, labelWidthMm: 5000, labelHeightMm: 5000 } as never),
    ).rejects.toBeTruthy();
  });

  it('mainTck: ТЦК, де найбільше працюючих; без юрособи — null', async () => {
    w.db.getRepository(Employee).qb({ getRawOne: { tckId: 't1' } });
    expect((await w.legalEntities.mainTck('le1'))?.name).toBe('Шевченківський РТЦК та СП');
    expect(await w.legalEntities.mainTck(null)).toBeNull();
    const sample = await w.legalEntities.sampleLabel('le1');
    expect(sample.recipient.name ?? JSON.stringify(sample.recipient)).toContain('Шевченківськ');
  });

  it('sampleLabel без ТЦК — зразок адресата', async () => {
    const sample = await w.legalEntities.sampleLabel('le1');
    expect(sample.sender).toBeTruthy();
    expect(sample.recipient).toBeTruthy();
  });
});

describe('LegalEntitiesService: адреси й користувачі', () => {
  it('notifyEmails: адреси юрособи; усіх — без повторів', async () => {
    expect(await w.legalEntities.notifyEmails('le1')).toEqual(['hr@example.com', 'boss@example.com']);
    await w.legalEntities.update('le2', { notifyEmails: 'hr@example.com,other@example.com' } as never);
    expect(await w.legalEntities.notifyEmails(null)).toEqual([
      'hr@example.com',
      'boss@example.com',
      'other@example.com',
    ]);
  });

  it('entityOfUser: юрособа облікового запису, або єдина в системі', async () => {
    w.db.getRepository(User).seed({ id: 'u1', email: 'a@example.com', legalEntityId: 'le1' } as never);
    w.db.getRepository(User).seed({ id: 'u2', email: 'b@example.com', legalEntityId: null } as never);
    expect(await w.legalEntities.entityOfUser('u1')).toEqual({ name: 'ТОВ «Вигадана компанія»', code: '12345678' });
    expect(await w.legalEntities.entityOfUser('u2')).toBeNull();
    await w.legalEntities.remove('le2');
    expect((await w.legalEntities.entityOfUser('u2'))?.code).toBe('12345678');
  });

  it('list: працівники за юрособою, квота, усі разом зі звільненими', async () => {
    w.seedEmployee({ legalEntityId: 'le1' });
    w.seedEmployee({ legalEntityId: 'le1', dismissalDate: '2020-01-01' });
    w.db.getRepository(Employee).qb({ getRawMany: [{ legalEntityId: 'le1', count: '2' }] });
    const list = await w.legalEntities.list('2026-11-24');
    const le1 = list.find((e) => e.id === 'le1')!;
    expect(le1.employees).toBe(1);
    expect(le1.allEmployees).toBe(2);
    expect(le1.quota).toBeTruthy();
    expect(await w.legalEntities.all('le2')).toHaveLength(1);
  });
});

describe('LegalEntitiesService.lookup — ЄДР', () => {
  it('без адреси реєстру — сервіс вимкнено', async () => {
    (w.legalEntities as unknown as { env: object }).env = {
      ...(w.legalEntities as unknown as { env: object }).env,
      companyRegistryUrl: '',
    };
    await expect(w.legalEntities.lookup('12345678')).rejects.toThrow('COMPANY_REGISTRY_URL');
  });

  it('реєстр не відповідає / не знайдено / знайдено', async () => {
    (w.legalEntities as unknown as { env: { companyRegistryUrl: string } }).env = {
      ...(w.legalEntities as unknown as { env: object }).env,
      companyRegistryUrl: 'https://registry.example.com/{code}',
    } as never;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    await expect(w.legalEntities.lookup('12345678')).rejects.toThrow('Реєстр не відповідає');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 404 })),
    );
    await expect(w.legalEntities.lookup('12345678')).rejects.toThrow('не знайдено');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => null })),
    );
    await expect(w.legalEntities.lookup('12345678')).rejects.toThrow('не знайдено');
  });
});
