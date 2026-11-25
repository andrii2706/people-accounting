import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN, HR } from '../../test/fixtures.js';
import { wire } from '../../test/wiring.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import type { QuotaWatchService } from '../notifications/quota-watch.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { LegalEntitiesController } from './legal-entities.controller.js';
import type { LegalEntityAccessService } from './legal-entity-access.service.js';
import { LegalEntity } from './legal-entity.entity.js';

const DIRECTOR = { ...HR, id: 'u-dir', role: 'DIRECTOR' } as AuthUser;
let w: ReturnType<typeof wire>;
let access: Record<string, ReturnType<typeof vi.fn>>;
let quota: Record<string, ReturnType<typeof vi.fn>>;
let c: LegalEntitiesController;
const journal = () => w.db.getRepository<AuditLog>(AuditLog).rows;

beforeEach(() => {
  w = wire();
  access = {
    people: vi.fn(async () => ({ HEAD: { userId: 'u-old', email: 'old@example.com' }, RESPONSIBLE: null })),
    grant: vi.fn(async () => ({ access: { userId: 'u9', email: 'new@example.com' }, temporaryPassword: 'x' })),
    revoke: vi.fn(async () => ({ deactivated: true, email: 'old@example.com' })),
    change: vi.fn(async (id: string, _who: string, dto: { fullName: string }) => {
      await w.legalEntities.update(id, { headName: dto.fullName } as never);
      return {
        revoked: { deactivated: true, email: 'old@example.com' },
        granted: { access: { email: 'new@example.com' } },
      };
    }),
    adoptByDirector: vi.fn(),
  };
  quota = {
    page: vi.fn(async () => ({ quota: {} })),
    saveSettings: vi.fn(async (_id: string, dto: object) => ({
      exceeded: true,
      decreased: true,
      expiring: true,
      ...dto,
    })),
    recalc: vi.fn(),
  };
  c = new LegalEntitiesController(
    w.legalEntities,
    access as unknown as LegalEntityAccessService,
    w.audit,
    quota as unknown as QuotaWatchService,
  );
});

describe('LegalEntitiesController: межі юрособи', () => {
  it('чужа юрособа — «не знайдено» для кожної дії', async () => {
    const calls: (() => unknown)[] = [
      () => c.quotaPage('le2', 'le1'),
      () => c.saveQuotaNotify('le2', {} as never, HR, 'le1'),
      () => c.get('le2', 'le1'),
      () => c.people('le2', 'le1'),
      () => c.grant('le2', 'HEAD', { email: 'x@example.com' } as never, HR, 'le1'),
      () => c.revoke('le2', 'HEAD', HR, 'le1'),
      () => c.change('le2', 'HEAD', { fullName: 'x' } as never, HR, 'le1'),
      () => c.history('le2', 'le1'),
      () => c.labelSettings('le2', 'le1'),
      () => c.saveLabelSettings('le2', {} as never, HR, 'le1'),
      () => c.letterhead('le2', 'le1'),
      () => c.saveLetterhead('le2', {} as never, HR, 'le1'),
      () => c.update('le2', {} as never, HR, 'le1'),
    ];
    for (const call of calls) await expect(Promise.resolve().then(call)).rejects.toThrow('Юридичну особу не знайдено');
  });

  it('список: свій — одна; без юрособи — порожньо; адміністратор — усі', async () => {
    w.db.getRepository(LegalEntity).qb({ getRawMany: [] });
    expect(await c.list(HR)).toHaveLength(1);
    expect(await c.list({ ...HR, legalEntityId: null })).toEqual([]);
    expect(await c.list(ADMIN)).toHaveLength(2);
    expect((await c.get('le1', 'le1')).edrpou).toBe('12345678');
  });
});

describe('LegalEntitiesController: квота', () => {
  it('сторінка квоти і листи — зі збереженням у журналі', async () => {
    await c.quotaPage('le1', 'le1');
    expect(quota['page']).toHaveBeenCalledWith('le1');
    const saved = await c.saveQuotaNotify('le1', { expiring: false } as never, HR, 'le1');
    expect(saved.expiring).toBe(false);
    expect(journal().at(-1)?.diff).toHaveProperty('quotaNotify');
  });

  it('новий відсоток квоти чи строк — перерахунок; прибрали квоту — «Квоту прибрано»', async () => {
    await c.update('le1', { reservationQuotaPercent: 30 } as never, HR, 'le1');
    expect(quota['recalc']).toHaveBeenLastCalledWith(['le1'], 'Змінено відсоток квоти: 30 %');
    await c.update('le1', { reservationQuotaPercent: null } as never, HR, 'le1');
    expect(quota['recalc']).toHaveBeenLastCalledWith(['le1'], 'Квоту прибрано');
    await c.update('le1', { reservationQuotaValidUntil: '2027-12-31' } as never, HR, 'le1');
    expect(quota['recalc']).toHaveBeenLastCalledWith(['le1'], 'Змінено строк дії рішення про квоту');
    quota['recalc'].mockClear();
    await c.update('le1', { phone: '' } as never, HR, 'le1');
    expect(quota['recalc']).not.toHaveBeenCalled();
  });
});

describe('LegalEntitiesController: керівник і відповідальний', () => {
  it('видати доступ — журнал з email; адміністратора юрособи призначає лише головний', async () => {
    await c.grant('le1', 'head', { email: 'new@example.com' } as never, HR, 'le1');
    expect(journal().at(-1)?.diff).toEqual({ HEAD_ACCESS: [null, 'new@example.com'] });
    await expect(
      c.grant('le1', 'HEAD', { email: 'x@example.com', role: 'ENTITY_ADMIN' } as never, HR, 'le1'),
    ).rejects.toThrow('призначає головний адміністратор');
    await c.grant('le1', 'HEAD', { email: 'x@example.com', role: 'ENTITY_ADMIN' } as never, ADMIN, null);
  });

  it('скасувати доступ і змінити людину — журнал з попереднім доступом', async () => {
    await c.revoke('le1', 'HEAD', HR, 'le1');
    expect(journal().at(-1)?.diff).toEqual({ HEAD_ACCESS: ['old@example.com', null] });
    await c.change('le1', 'HEAD', { fullName: 'Новий Керівник', email: 'new@example.com' } as never, HR, 'le1');
    expect(journal().at(-1)?.diff).toMatchObject({
      headName: ['Вигаданий Директор Тестович', 'Новий Керівник'],
      HEAD_ACCESS: ['old@example.com', 'new@example.com'],
      HEAD_PREVIOUS_ACCESS: ['old@example.com', 'скасовано'],
    });
    expect(await c.people('le1', 'le1')).toHaveProperty('HEAD');
  });

  it('невідома роль у шляху — помилка', async () => {
    await expect(c.revoke('le1', 'BOSS', HR, 'le1')).rejects.toBeTruthy();
  });
});

describe('LegalEntitiesController: створення, наклейки, бланк, історія', () => {
  it('директор додає лише свою юрособу і стає її керівником', async () => {
    await expect(c.create({ fullName: 'x', edrpou: '11112222' } as never, DIRECTOR)).rejects.toThrow(
      'директор додає лише свою',
    );
    const own = await c.create({ fullName: 'ТОВ «Нова»', edrpou: '11112222' } as never, {
      ...DIRECTOR,
      legalEntityId: null,
    });
    expect(access['adoptByDirector']).toHaveBeenCalledWith(own.id, expect.anything());
    expect(journal().at(-1)).toMatchObject({ action: 'CREATE' });
    await c.remove(own.id, ADMIN);
    expect(journal().at(-1)).toMatchObject({ action: 'DELETE' });
  });

  it('наклейки й бланк: сторінка і збереження зі змінами в журналі', async () => {
    const labels = await c.labelSettings('le1', 'le1');
    expect(labels.sample.sender).toBeTruthy();
    await c.saveLabelSettings('le1', { ...labels.settings, declaredValue: 99 } as never, HR, 'le1');
    expect(journal().at(-1)?.action).toBe('UPDATE');
    const head = await c.letterhead('le1', 'le1');
    expect(head.requisites.edrpou).toBe('12345678');
    const n = journal().length;
    await c.saveLetterhead('le1', head.settings, HR, 'le1');
    expect(journal()).toHaveLength(n);
    const history = await c.history('le1', 'le1');
    expect(Array.isArray(history)).toBe(true);
  });

  it('пошук у ЄДР — через сервіс', async () => {
    const lookup = vi.spyOn(w.legalEntities, 'lookup').mockResolvedValue({ edrpou: '11112222' } as never);
    await c.lookup({ edrpou: '11112222' } as never);
    expect(lookup).toHaveBeenCalledWith('11112222');
  });
});
