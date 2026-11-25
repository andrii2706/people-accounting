import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import type { Employee } from '../employees/entities/employee.entity.js';
import type { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { QuotaRecalculation } from '../legal-entities/quota-recalculation.entity.js';
import type { MailLetter } from '../shared/interfaces/mail.interface.js';
import type { NotificationsService } from './notifications.service.js';
import { QuotaWatchService } from './quota-watch.service.js';
import { quotaLetter } from './templates/quota-letter.template.js';

process.env['DATABASE_URL'] ??= 'postgres://test:test@localhost/test';
process.env['JWT_SECRET'] ??= 'test-only-secret-0123456789abcdef-0123';
process.env['DATA_ENCRYPTION_KEY'] ??= Buffer.alloc(32, 1).toString('base64');
process.env['BLIND_INDEX_KEY'] ??= Buffer.alloc(32, 2).toString('base64');

const TODAY = '2026-11-24';

/** A working military-liable man (fictional); reserved — by this company. */
function man(i: number, reserved = false, dismissalDate: string | null = null): Employee {
  return {
    id: `e${i}`,
    legalEntityId: 'le1',
    gender: 'M',
    lastName: 'Вигаданий',
    firstName: 'Петро',
    middleName: 'Іванович',
    birthDate: '1990-01-01',
    hireDate: '2020-01-01',
    dismissalDate,
    militaryRegistered: true,
    rankCode: 1,
    reserved,
    reservedBy: 'COMPANY',
    reservationUntil: reserved ? '2026-12-31' : null,
    partTimeNotInQuota: false,
    mobilizedAt: null,
    demobilizedAt: null,
    reserveTeamNumber: '',
    militaryDocuments: [],
  } as unknown as Employee;
}

function setup(staff: Employee[], entity: Partial<LegalEntity> = {}) {
  const le = {
    id: 'le1',
    fullName: 'ТОВ «Вигадана компанія»',
    shortName: 'Вигадана компанія',
    edrpou: '12345678',
    reservationQuotaPercent: 50,
    reservationQuotaValidUntil: '2026-12-31',
    quotaNotifyExceeded: true,
    quotaNotifyDecreased: true,
    quotaNotifyExpiring: true,
    quotaExceededNotified: null,
    notifyEmails: '',
    ...entity,
  } as LegalEntity;
  const rows: QuotaRecalculation[] = [];
  const letters: MailLetter[] = [];
  const employees = { find: async () => staff } as unknown as Repository<Employee>;
  const entities = {
    findOneBy: async () => le,
    findOneByOrFail: async () => le,
    find: async () => [le],
    update: async (_id: string, patch: Partial<LegalEntity>) => Object.assign(le, patch),
    save: async (x: LegalEntity) => x,
  } as unknown as Repository<LegalEntity>;
  const recalcs = {
    findOne: async () => rows.at(-1) ?? null,
    find: async () => [...rows].reverse(),
    create: (x: Partial<QuotaRecalculation>) => ({ ...x, createdAt: new Date() }),
    save: async (x: QuotaRecalculation) => rows.push(x),
  } as unknown as Repository<QuotaRecalculation>;
  const notifications = {
    notifyUsersLetter: async (l: MailLetter) => letters.push(l),
    recipients: async () => ['hr@example.com'],
    wasSent: async () => false,
    markSent: async () => undefined,
    mailConfigured: true,
  } as unknown as NotificationsService;
  return { svc: new QuotaWatchService(employees, entities, recalcs, notifications), rows, letters, le, staff };
}

describe('QuotaWatchService', () => {
  it('writes a recalculation only when the numbers changed', async () => {
    const t = setup([man(1, true), man(2), man(3), man(4)]);
    await t.svc.recalc(['le1'], 'Прийнято: Вигаданий П. І.', TODAY);
    await t.svc.recalc(['le1', 'le1', null], 'Щоденна перевірка', TODAY);
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({
      base: 4,
      quota: 2,
      reservedCompany: 1,
      available: 1,
      exceeded: false,
      prevBase: null,
    });
  });

  it('e-mails an exceeded quota once, again only when it grows, and resets after it is back to normal', async () => {
    const staff = [man(1, true), man(2, true), man(3, true), man(4)];
    const t = setup(staff);
    await t.svc.recalc(['le1'], 'Заброньовано: Вигаданий П. І.', TODAY); // 4 → 2 places, 3 reserved
    expect(t.letters.map((l) => l.subject)).toEqual(['Вигадана компанія: квоту бронювання перевищено на 1']);
    await t.svc.recalc(['le1'], 'Щоденна перевірка', TODAY);
    expect(t.letters).toHaveLength(1);
    staff[3] = man(4, false, '2026-11-20'); // dismissed: base 3 → 1 place, over by 2
    await t.svc.recalc(['le1'], 'Звільнено: Вигаданий П. І.', TODAY);
    expect(t.letters).toHaveLength(2);
    expect(t.le.quotaExceededNotified).toBe(2);
    staff.splice(0, 3, man(1), man(2), man(3)); // reservations removed
    await t.svc.recalc(['le1'], 'Знято бронювання', TODAY);
    expect(t.le.quotaExceededNotified).toBeNull();
  });

  it('e-mails fewer free places, never the names', async () => {
    const staff = [man(1, true), man(2), man(3), man(4), man(5), man(6)];
    const t = setup(staff);
    await t.svc.recalc(['le1'], 'Початок', TODAY); // 6 → 3 places, 1 reserved, 2 free
    staff.pop();
    staff.pop(); // 4 → 2 places, 1 free
    await t.svc.recalc(['le1'], 'Звільнено: Вигаданий П. І.', TODAY);
    expect(t.letters).toHaveLength(1);
    expect(t.letters[0].subject).toContain('2 → 1');
    expect(t.letters[0].text).not.toContain('Вигаданий');
    expect(t.letters[0].html).not.toContain('Вигаданий');
    expect(t.letters[0].text).toContain('Звільнено.');
  });

  it('no e-mail when switched off', async () => {
    const t = setup([man(1, true), man(2, true), man(3, true)], { quotaNotifyExceeded: false });
    await t.svc.recalc(['le1'], 'Заброньовано', TODAY);
    expect(t.letters).toHaveLength(0);
    expect(t.le.quotaExceededNotified).toBe(2);
  });

  it('the decision ends in 14 days — one e-mail', async () => {
    const t = setup([man(1)], { reservationQuotaValidUntil: '2026-12-01' });
    const r = await t.svc.daily(TODAY);
    expect(r.expiring).toBe(1);
    expect(t.letters.at(-1)?.subject).toContain('діє до 01.12.2026');
  });
});

describe('quotaLetter', () => {
  it('numbers and the link, HTML-escaped', () => {
    const l = quotaLetter({
      kind: 'EXCEEDED',
      entityName: 'ТОВ <Тест>',
      entityCode: '12345678',
      reason: 'Звільнено',
      percent: 50,
      base: 10,
      prevBase: 11,
      quota: 5,
      reservedCompany: 6,
      available: 0,
      prevAvailable: 0,
      validUntil: null,
      url: 'https://example.com/legal-entities/1/quota',
    });
    expect(l.subject).toBe('ТОВ <Тест>: квоту бронювання перевищено на 1');
    expect(l.text).toContain('11 → 10');
    expect(l.html).toContain('ТОВ &lt;Тест&gt;');
    expect(l.html).toContain('https://example.com/legal-entities/1/quota');
  });
});
