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

function setup(readKeys: string[] = []) {
  const repo = (rows: unknown[]) => ({ find: () => Promise.resolve(rows) });
  const pending = [
    { id: 'c1', type: 'ADDRESS', effectiveDate: '2026-09-10', employee, letterId: null, skipped: false },
  ];
  const reads = {
    find: () => Promise.resolve(readKeys.map((key) => ({ key }))),
  };
  const org = { get: () => Promise.resolve({ alertDays: 30, notifyDeadlineDays: 7 }) };
  return new InboxService(repo([employee]) as never, repo(pending) as never, reads as never, org as never);
}

describe('InboxService — сповіщення по працівниках', () => {
  it('строки, повідомлення ТЦК і дані картки; спершу непрочитані й небезпечні', async () => {
    const view = await setup().list('u1', TODAY);
    const kinds = view.items.map((i) => `${i.kind}:${i.level}`);
    expect(kinds).toContain('DEADLINE:warning');
    expect(kinds).toContain('TCK:danger'); // зміна адреси від 10.09 — строк до 05.10 минув
    expect(kinds).toContain('CARD:warning'); // не обрано ТЦК
    expect(view.items[0].level).toBe('danger');
    expect(view.unread).toBe(view.items.length);
  });

  it('ключ стабільний: та сама відстрочка — той самий ключ, прочитане не повертається', async () => {
    const first = await setup().list('u1', TODAY);
    const deferral = first.items.find((i) => i.kind === 'DEADLINE')!;
    expect(deferral.key).toBe('DEFERRAL_EXPIRING:e1:2026-11-13');
    // наступного дня текст «через N днів» змінюється, а ключ — ні
    const next = await setup([deferral.key]).list('u1', '2026-11-04');
    expect(next.items.find((i) => i.kind === 'DEADLINE')).toMatchObject({ key: deferral.key, read: true });
    expect(next.unread).toBe(next.items.length - 1);
  });
});
