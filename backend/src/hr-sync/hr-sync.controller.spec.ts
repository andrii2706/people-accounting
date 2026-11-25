import { beforeEach, describe, expect, it } from 'vitest';
import { HR } from '../../test/fixtures.js';
import { FakeDb } from '../../test/fake-db.js';
import { spyService, type SpyService } from '../../test/mocks.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { HrPushController, HrSyncController } from './hr-sync.controller.js';
import type { HrSyncService } from './hr-sync.service.js';

const LE = 'le1';
const B = 'b1';
let db: FakeDb;
let sync: SpyService;
let c: HrSyncController;
const journal = () => db.getRepository<AuditLog>(AuditLog).rows;

beforeEach(() => {
  db = new FakeDb();
  sync = spyService({
    issueToken: { token: 'mr1c_x', settings: { tokenPrefix: 'mr1c_x' } },
    apply: { status: 'APPLIED' },
  });
  sync['label'] = Object.assign(() => 'ЗУП, надсилання з 1С, постійно', { mock: true }) as never;
  c = new HrSyncController(sync as unknown as HrSyncService, new AuditService(db.getRepository(AuditLog) as never));
});

describe('HrSyncController', () => {
  it('чужа юрособа — «не знайдено» для кожної дії', async () => {
    const calls: (() => Promise<unknown>)[] = [
      () => c.get(LE, 'le2'),
      () => c.save(LE, {} as never, HR, 'le2'),
      () => c.remove(LE, HR, 'le2'),
      () => c.reopen(LE, HR, 'le2'),
      () => c.token(LE, {} as never, HR, 'le2'),
      () => c.revoke(LE, HR, 'le2'),
      () => c.check(LE, 'le2'),
      () => c.pull(LE, HR, 'le2'),
      () => c.history(LE, 'le2'),
      () => c.batch(LE, B, HR, 'le2'),
      () => c.apply(LE, B, HR, 'le2'),
      () => c.discard(LE, B, HR, 'le2'),
    ];
    for (const call of calls) await expect(Promise.resolve().then(call)).rejects.toThrow();
    for (const name of ['view', 'save', 'remove', 'reopen', 'issueToken', 'pull', 'apply', 'discard']) {
      expect(sync[name]).not.toHaveBeenCalled();
    }
  });

  it('налаштування, ключ, відкликання, вимкнення, «отримати ще раз» — у журналі', async () => {
    await c.get(LE, LE);
    await c.save(LE, { mode: 'PUSH' } as never, HR, LE);
    const issued = await c.token(LE, { validDays: 30 } as never, HR, LE);
    expect(issued.token).toBe('mr1c_x');
    expect(sync['issueToken']).toHaveBeenCalledWith(LE, HR, 30);
    await c.revoke(LE, HR, LE);
    await c.reopen(LE, HR, LE);
    await c.remove(LE, HR, LE);
    expect(journal().map((r) => Object.keys(r.diff)[0])).toEqual([
      'HR_SYNC',
      'HR_SYNC_TOKEN',
      'HR_SYNC_TOKEN',
      'HR_SYNC_ONCE',
      'HR_SYNC',
    ]);
  });

  it('OData і отримання: перевірити, отримати, переглянути, застосувати, відхилити', async () => {
    await c.check(LE, LE);
    await c.pull(LE, HR, LE);
    expect(sync['pull']).toHaveBeenCalledWith(LE, 'ODATA_MANUAL', HR);
    await c.history(LE, LE);
    await c.batch(LE, B, HR, LE);
    await c.apply(LE, B, HR, LE);
    await c.discard(LE, B, HR, LE);
    expect(journal().map((r) => r.action)).toEqual(['VIEW', 'UPDATE', 'UPDATE']);
    expect(journal()[1].diff).toEqual({ status: ['PENDING', 'APPLIED'] });
  });
});

describe('HrPushController — дані з 1С', () => {
  it('ключ з заголовка й адреса передаються сервісу', async () => {
    const push = new HrPushController(sync as unknown as HrSyncService);
    const req = { ip: '::ffff:10.0.0.7', headers: {}, socket: {} } as never;
    await push.push('Bearer mr1c_x', { employees: [] }, req);
    await push.ping('Bearer mr1c_x', req);
    expect(sync['receivePush'].mock.calls[0][0]).toBe('Bearer mr1c_x');
    expect(sync['ping']).toHaveBeenCalled();
  });
});
