import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HR } from '../../test/fixtures.js';
import { FakeDb } from '../../test/fake-db.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { ChangeNoticesController, LettersController } from './letters.controller.js';
import type { LettersService } from './letters.service.js';

const ID = '3f1d2c4b-5a69-4e78-9f01-23456789abcd';
const FILE = { buffer: Buffer.from('PK'), filename: 'Лист ВО-1.docx' };
let db: FakeDb;
let letters: Record<string, ReturnType<typeof vi.fn>>;
let c: LettersController;
const journal = () => db.getRepository<AuditLog>(AuditLog).rows;

beforeEach(() => {
  db = new FakeDb();
  const ok = (v: unknown = {}) => vi.fn(async () => v);
  letters = {
    list: ok([]),
    assertEmployees: ok(),
    assertAccess: ok(),
    createChangeNotices: ok([]),
    createChangeNotice: ok(),
    createExternalNotice: ok(),
    createReportLetter: ok(),
    labels: ok(FILE),
    labelPrintData: ok({ groups: [] }),
    get: ok(),
    update: ok(),
    remove: ok(),
    document: ok(FILE),
    reconciliation: ok(FILE),
    inventory: ok(FILE),
    postPackage: ok({ ...FILE, filename: 'Для пошти ВО-1.zip' }),
    markSent: ok(),
    notices: ok([]),
    noticeDocument: ok({ ...FILE, letterId: ID }),
  };
  c = new LettersController(
    letters as unknown as LettersService,
    new AuditService(db.getRepository(AuditLog) as never),
  );
});

describe('LettersController', () => {
  it('створення листів — спершу перевірка, що працівники своєї юрособи', async () => {
    await c.createChangeNotices({ employeeIds: ['e1', 'e2'] } as never, HR, 'le1');
    expect(letters['assertEmployees']).toHaveBeenLastCalledWith(['e1', 'e2'], 'le1');
    await c.createChangeNotice({ employeeId: 'e1' } as never, HR, 'le1');
    await c.createExternalNotice({ employeeId: 'e1' } as never, HR, 'le1');
    await c.createReport({ type: 'LISTS', employeeIds: ['e1'] } as never, HR, 'le1');
    expect(letters['createReportLetter'].mock.calls[0][0].legalEntityId).toBe('le1');
    letters['assertEmployees'].mockRejectedValueOnce(new Error('Працівника не знайдено'));
    await expect(c.createChangeNotice({ employeeId: 'x' } as never, HR, 'le1')).rejects.toThrow(
      'Працівника не знайдено',
    );
  });

  it('файли листа — у журналі як EXPORT; звірка лише cover / inventory / all', async () => {
    await c.docx(ID, HR, 'le1');
    await c.reconciliation(ID, 'cover', HR, 'le1');
    await c.reconciliation(ID, 'щось', HR, 'le1');
    expect(letters['reconciliation'].mock.calls.map((x) => x[1])).toEqual(['cover', 'all']);
    await c.inventory(ID, HR, 'le1');
    await c.postPackage(ID, HR, 'le1');
    expect(journal().map((r) => r.action)).toEqual(['EXPORT', 'EXPORT', 'EXPORT', 'EXPORT', 'EXPORT']);
  });

  it('наклейки: перелік id обов’язково UUID', async () => {
    await c.labels(ID, HR, 'le1');
    await c.labelsPrint(`${ID},${ID}`, HR, 'le1');
    expect(journal()).toHaveLength(2);
    await expect(Promise.resolve().then(() => c.labels('bad', HR, 'le1'))).rejects.toThrow('UUID');
  });

  it('лист: доступ перевіряється перед кожною дією', async () => {
    for (const run of [
      () => c.get(ID, 'le1'),
      () => c.update(ID, {} as never, 'le1'),
      () => c.remove(ID, 'le1'),
      () => c.markSent(ID, HR, 'le1'),
    ]) {
      letters['assertAccess'].mockRejectedValueOnce(new Error('Лист не знайдено'));
      await expect(run()).rejects.toThrow('Лист не знайдено');
    }
    await c.list({} as never, 'le1');
    expect(letters['list']).toHaveBeenCalledWith({}, 'le1');
  });
});

describe('ChangeNoticesController', () => {
  it('історія повідомлень і окреме повідомлення .docx', async () => {
    const n = new ChangeNoticesController(
      letters as unknown as LettersService,
      new AuditService(db.getRepository(AuditLog) as never),
    );
    await n.list({ employeeId: 'e1' } as never, 'le1');
    await n.docx(ID, HR, 'le1');
    expect(journal()[0]).toMatchObject({ entityId: ID, action: 'EXPORT' });
  });
});
