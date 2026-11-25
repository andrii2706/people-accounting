import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wire } from '../../test/wiring.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { User } from '../users/user.entity.js';
import { BillingSettings } from './billing-settings.entity.js';
import { Invoice } from './invoice.entity.js';
import { Subscription } from './subscription.entity.js';
import type { SubscriptionGateService } from './subscription-gate.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

const DIRECTOR = {
  id: 'u-dir',
  email: 'boss@example.com',
  fullName: 'Керівник Тестовий',
  role: 'DIRECTOR',
  legalEntityId: 'le1',
} as AuthUser;
const HR = { ...DIRECTOR, id: 'u-hr', role: 'HR' } as AuthUser;
const VENDOR = {
  id: 'u-v',
  email: 'vendor@example.com',
  fullName: 'Постачальник',
  role: 'VENDOR',
  legalEntityId: null,
} as AuthUser;

/** The vendor's requisites — fictional. */
const SELLER = {
  name: 'ФОП Вигаданий Постачальник',
  code: '1234567890',
  ipn: '',
  address: 'м. Тестове, вул. Уявна, 9',
  iban: 'ua21 3223 1300 0002 6007 2335 6600 1',
  bank: 'АТ «Тестовий банк»',
  phone: '+380500000001',
  email: 'billing@example.com',
  taxNote: 'Платник єдиного податку 3 групи',
  vatPayer: false,
};

let w: ReturnType<typeof wire>;
let gate: { forget: ReturnType<typeof vi.fn> };
let sendTo: ReturnType<typeof vi.fn>;
let service: SubscriptionsService;
const invoices = () => w.db.getRepository<Invoice>(Invoice);
const subs = () => w.db.getRepository<Subscription>(Subscription);

beforeEach(() => {
  w = wire();
  w.db.getRepository<LegalEntity>(LegalEntity).rows[0].billingRequired = true;
  w.db.getRepository(User).seed(
    {
      id: 'u-dir',
      email: 'boss@example.com',
      fullName: 'Керівник Тестовий',
      role: 'DIRECTOR',
      legalEntityId: 'le1',
      isActive: true,
      createdAt: new Date('2026-11-01'),
    } as never,
    { id: 'u-v', email: 'vendor@example.com', fullName: 'Постачальник', role: 'VENDOR', isActive: true } as never,
  );
  invoices().qb({ getRawOne: () => ({ max: Math.max(0, ...invoices().rows.map((i) => i.sequence ?? 0)) }) });
  gate = { forget: vi.fn() };
  sendTo = vi.fn(async () => true);
  service = new SubscriptionsService(
    subs() as never,
    invoices() as never,
    w.db.getRepository(BillingSettings) as never,
    w.db.getRepository(LegalEntity) as never,
    w.db.getRepository(User) as never,
    w.db.dataSource as never,
    gate as unknown as SubscriptionGateService,
    w.audit,
    { sendTo } as unknown as NotificationsService,
  );
});

async function ready() {
  return service.updateSettings(
    {
      seller: SELLER,
      monthlyPrice: 500,
      yearlyPrice: 5000,
      enterpriseText: '',
      serviceName: '',
      invoicePrefix: 'ВО',
      dueDays: 5,
      trialDays: 14,
    } as never,
    VENDOR,
  );
}

describe('SubscriptionsService: налаштування постачальника', () => {
  it('без реквізитів — не готово; збереження: IBAN без пробілів, великими', async () => {
    expect((await service.settings()).ready).toBe(false);
    const view = await ready();
    expect(view.ready).toBe(true);
    expect(view.seller.iban).toBe('UA213223130000026007233566001');
    expect(view.serviceName).toContain('Військовий облік');
    const terms = await service.terms();
    expect(terms.intro).toContain('ФОП Вигаданий Постачальник');
  });
});

describe('SubscriptionsService: клієнт обирає тариф', () => {
  it('місячний: пробний період від реєстрації, рахунок з наступним номером, попередній неоплачений скасовано', async () => {
    await ready();
    const view = await service.choosePlan(DIRECTOR, 'MONTHLY');
    expect(view.plan).toBe('MONTHLY');
    expect(view.trialUntil).toBe('2026-11-14');
    expect(view.invoices).toHaveLength(1);
    expect(view.invoices[0].number).toMatch(/^ВО-\d{4}-0001$/);
    expect(view.invoices[0].total).toBe(500);
    const again = await service.choosePlan(DIRECTOR, 'YEARLY');
    expect(again.invoices.map((i) => i.status).sort((a, b) => a.localeCompare(b))).toEqual(['CANCELLED', 'ISSUED']);
    expect(gate.forget).toHaveBeenCalledWith('le1');
  });

  it('Enterprise — заявка постачальнику листом, без рахунку', async () => {
    await ready();
    const view = await service.choosePlan(DIRECTOR, 'ENTERPRISE', ' 300 працівників ');
    expect(view.invoices).toHaveLength(0);
    expect((sendTo.mock.calls[0][0] as string[]).sort((a, b) => a.localeCompare(b))).toEqual([
      'billing@example.com',
      'vendor@example.com',
    ]);
    expect(sendTo.mock.calls[0][2]).toContain('Побажання: 300 працівників');
    await expect(service.renew(DIRECTOR)).rejects.toThrow('Enterprise');
  });

  it('хто може: кадровик — ні; юрособа за договором — ні; без юрософи — ні', async () => {
    await ready();
    await expect(service.choosePlan(HR, 'MONTHLY')).rejects.toThrow('Тариф обирає керівник');
    await expect(service.choosePlan({ ...DIRECTOR, legalEntityId: null }, 'MONTHLY')).rejects.toThrow('додайте свою');
    w.db.getRepository<LegalEntity>(LegalEntity).rows[0].billingRequired = false;
    await expect(service.choosePlan(DIRECTOR, 'MONTHLY')).rejects.toThrow('окремим договором');
  });

  it('тариф без ціни — недоступний', async () => {
    await service.updateSettings(
      {
        seller: SELLER,
        monthlyPrice: null,
        yearlyPrice: 5000,
        enterpriseText: 'Індивідуально',
        serviceName: 'Доступ',
        invoicePrefix: '',
        dueDays: 5,
        trialDays: 14,
      } as never,
      VENDOR,
    );
    await expect(service.choosePlan(DIRECTOR, 'MONTHLY')).rejects.toThrow('ще не доступний');
    const view = await service.view(DIRECTOR);
    expect(view.plans.find((p) => p.plan === 'ENTERPRISE')?.description).toBe('Індивідуально');
  });

  it('renew: відкритий рахунок повертається той самий; без тарифу — помилка', async () => {
    await ready();
    await expect(service.renew(DIRECTOR)).rejects.toThrow('Спершу оберіть тариф');
    await service.choosePlan(DIRECTOR, 'MONTHLY');
    const first = await service.renew(DIRECTOR);
    const second = await service.renew(DIRECTOR);
    expect(second.id).toBe(first.id);
  });

  it('файл рахунку: своєї юрософи, адміністратор, постачальник; чужим — «не знайдено»', async () => {
    await ready();
    const view = await service.choosePlan(DIRECTOR, 'MONTHLY');
    const file = await service.invoiceFile(view.invoices[0].id, DIRECTOR);
    expect(file.filename).toBe(`Рахунок ${view.invoices[0].number}.docx`);
    await expect(service.invoiceFile(view.invoices[0].id, HR)).rejects.toThrow('Рахунок не знайдено');
    await expect(service.invoiceFile(view.invoices[0].id, VENDOR)).resolves.toBeTruthy();
  });
});

describe('SubscriptionsService: постачальник', () => {
  it('оплата: доступ до кінця періоду рахунку; вдруге — не можна; скасування лише неоплаченого', async () => {
    await ready();
    const view = await service.choosePlan(DIRECTOR, 'MONTHLY');
    const inv = view.invoices[0];
    const paid = await service.markPaid(inv.id, '2026-11-20', VENDOR);
    expect(paid).toMatchObject({ status: 'PAID', paidAt: '2026-11-20' });
    expect(subs().rows[0].paidUntil).toBe(inv.periodTo);
    await expect(service.markPaid(inv.id, undefined, VENDOR)).rejects.toThrow('лише виставлений');
    await expect(service.cancel(inv.id, VENDOR)).rejects.toThrow('лише неоплачений');
    const next = await service.renew(DIRECTOR);
    expect((await service.cancel(next.id, VENDOR)).status).toBe('CANCELLED');
    await expect(service.markPaid('nope', undefined, VENDOR)).rejects.toThrow('Рахунок не знайдено');
  });

  it('список підписок, продовження пробного, рахунок вручну', async () => {
    await ready();
    await service.choosePlan(DIRECTOR, 'ENTERPRISE');
    invoices().qb({ getRawMany: [] });
    const [row] = await service.list();
    expect(row).toMatchObject({ entityCode: '12345678', ownerEmail: 'boss@example.com', plan: 'ENTERPRISE' });
    const extended = await service.extendTrial(row.id, '2026-12-31', VENDOR);
    expect(extended.trialUntil).toBe('2026-12-31');
    const manual = await service.vendorInvoice(
      row.id,
      { months: 6, total: 12000, description: 'Особливі умови' } as never,
      VENDOR,
    );
    expect(manual.total).toBe(12000);
    expect(await service.vendorInvoices(row.id)).toHaveLength(1);
    await expect(service.extendTrial('nope', '2026-12-31', VENDOR)).rejects.toThrow('Підписку не знайдено');
  });

  it('рахунок вручну без реквізитів — перелік чого бракує', async () => {
    await ready();
    await service.choosePlan(DIRECTOR, 'ENTERPRISE');
    await service.updateSettings(
      {
        seller: { ...SELLER, iban: '', bank: '' },
        monthlyPrice: 500,
        yearlyPrice: 5000,
        enterpriseText: '',
        serviceName: '',
        invoicePrefix: 'ВО',
        dueDays: 5,
        trialDays: 14,
      } as never,
      VENDOR,
    );
    await expect(service.vendorInvoice(subs().rows[0].id, { months: 1, total: 1 } as never, VENDOR)).rejects.toThrow(
      'Заповніть реквізити',
    );
  });
});
