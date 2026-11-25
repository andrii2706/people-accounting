import { describe, expect, it } from 'vitest';
import { InboxService } from './inbox.service.js';

process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-123';
process.env.DATABASE_URL ??= 'postgres://test@localhost/test';

const TODAY = '2026-11-03';

/** Employee with a deferral ending in 10 days and no TCK chosen. */
const employee = {
  id: 'e1',
  lastName: 'Приклад',
  firstName: 'Петро',
  middleName: 'Іванович',
  gender: 'M',
  birthDate: '1990-01-01',
  rankCode: 2,
  navy: false,
  hireDate: '2020-01-01',
  dismissalDate: null,
  militaryRegistered: true,
  reserveTeamNumber: '',
  mobilizationOrderDate: null,
  reserved: false,
  reservationBasis: '',
  reservationUntil: null,
  reservedBy: 'COMPANY',
  specialAccountingCertificate: '',
  deferralUntil: '2026-11-13',
  nextVlkDate: null,
  mobilizedAt: null,
  demobilizedAt: null,
  registryNumber: '123',
  tckId: null,
  trainingProfile: '',
  militaryDocuments: [{ type: 'військовий квиток', number: '000001', series: 'АА' }],
};

function setup(readKeys: string[] = [], entities: unknown[] = [], staff: unknown[] = [employee]) {
  const repo = (rows: unknown[]) => ({ find: () => Promise.resolve(rows) });
  const pending = [
    { id: 'c1', type: 'ADDRESS', effectiveDate: '2026-09-10', employee, letterId: null, skipped: false },
  ];
  const reads = {
    find: () => Promise.resolve(readKeys.map((key) => ({ key }))),
  };
  const org = { get: () => Promise.resolve({ alertDays: 30, notifyDeadlineDays: 7 }) };
  return new InboxService(
    repo(staff) as never,
    repo(pending) as never,
    reads as never,
    repo(entities) as never,
    org as never,
  );
}

/** The main administrator: notifications about every legal entity (fictional account). */
const ADMIN = {
  id: 'u1',
  email: 'admin@example.com',
  fullName: 'Адміністратор',
  role: 'ADMIN',
  legalEntityId: null,
  mustChangePassword: false,
} as const;

describe('InboxService — сповіщення по працівниках', () => {
  it('строки, повідомлення ТЦК і дані картки; спершу непрочитані й небезпечні', async () => {
    const view = await setup().list(ADMIN, TODAY);
    const kinds = view.items.map((i) => `${i.kind}:${i.level}`);
    expect(kinds).toContain('DEADLINE:warning');
    expect(kinds).toContain('TCK:danger'); // зміна адреси від 10.09 — строк до 05.10 минув
    expect(kinds).toContain('CARD:warning'); // не обрано ТЦК
    expect(view.items[0].level).toBe('danger');
    expect(view.unread).toBe(view.items.length);
  });

  it('ключ стабільний: та сама відстрочка — той самий ключ, прочитане не повертається', async () => {
    const first = await setup().list(ADMIN, TODAY);
    const deferral = first.items.find((i) => i.kind === 'DEADLINE')!;
    expect(deferral.key).toBe('DEFERRAL_EXPIRING:e1:2026-11-13');
    // наступного дня текст «через N днів» змінюється, а ключ — ні
    const next = await setup([deferral.key]).list(ADMIN, '2026-11-04');
    expect(next.items.find((i) => i.kind === 'DEADLINE')).toMatchObject({ key: deferral.key, read: true });
    expect(next.unread).toBe(next.items.length - 1);
  });

  it('обліковий запис без юрособи не отримує сповіщень', async () => {
    const view = await setup().list({ ...ADMIN, role: 'DIRECTOR' }, TODAY);
    expect(view).toMatchObject({ items: [], unread: 0 });
  });
});

describe('InboxService — the reservation quota', () => {
  const entity = {
    id: 'le1',
    fullName: 'ТОВ «Вигадана компанія»',
    shortName: 'Вигадана компанія',
    reservationQuotaPercent: 50,
    reservationQuotaValidUntil: '2026-11-10',
  };
  const reserved = {
    ...employee,
    id: 'e2',
    legalEntityId: 'le1',
    reserved: true,
    reservationUntil: '2026-12-31',
    deferralUntil: null,
  };

  it('exceeded and the decision ending — on top, linking to the quota page', async () => {
    const view = await setup([], [entity], [reserved]).list(ADMIN, TODAY);
    const quota = view.items.filter((i) => i.kind === 'QUOTA');
    expect(quota.map((i) => [i.key, i.level, i.link, i.legalEntityId])).toEqual([
      ['QUOTA:le1:over:1', 'danger', 'QUOTA', 'le1'],
      ['QUOTA:le1:ends:2026-11-10', 'warning', 'QUOTA', 'le1'],
    ]);
    expect(quota[0].message).toContain('перевищено на 1');
    expect(quota[0].message).not.toContain('Приклад');
  });

  it('nothing while the quota holds', async () => {
    const view = await setup(
      [],
      [{ ...entity, reservationQuotaValidUntil: null }],
      [{ ...reserved, reserved: false }],
    ).list(ADMIN, TODAY);
    expect(view.items.some((i) => i.kind === 'QUOTA')).toBe(false);
  });
});
