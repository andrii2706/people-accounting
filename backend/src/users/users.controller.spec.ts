import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, HR } from '../../test/fixtures.js';
import { FakeDb } from '../../test/fake-db.js';
import { spyService, type SpyService } from '../../test/mocks.js';
import type { MfaService } from '../auth/mfa.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

const ID = '3f1d2c4b-5a69-4e78-9f01-23456789abcd';
const DIRECTOR = { ...HR, id: 'u-dir', role: 'DIRECTOR' } as AuthUser;
const TARGET = {
  id: ID,
  email: 'olga@example.com',
  fullName: 'Тестова Ольга',
  role: 'HR',
  legalEntityId: 'le1',
  isActive: true,
};

let db: FakeDb;
let users: SpyService;
let mfa: SpyService;
let c: UsersController;
const journal = () => db.getRepository<AuditLog>(AuditLog).rows;

beforeEach(() => {
  db = new FakeDb();
  users = spyService({
    findById: { ...TARGET },
    create: { ...TARGET },
    update: { ...TARGET, isActive: false },
    unlock: { ...TARGET },
  });
  mfa = spyService();
  c = new UsersController(
    users as unknown as UsersService,
    new AuditService(db.getRepository(AuditLog) as never),
    mfa as unknown as MfaService,
  );
});

describe('UsersController', () => {
  it('створення: юрособа — своя; роль, якої не можна видати, — відмова', async () => {
    await c.create(
      { email: 'new@example.com', fullName: 'Нова', password: 'x', role: 'HR', legalEntityId: 'le2' } as never,
      DIRECTOR,
      'le1',
    );
    expect(users['create'].mock.calls[0][0].legalEntityId).toBe('le1');
    expect(journal()[0]).toMatchObject({ action: 'CREATE' });
    await expect(Promise.resolve().then(() => c.create({ role: 'ADMIN' } as never, DIRECTOR, 'le1'))).rejects.toThrow(
      'призначає головний адміністратор',
    );
  });

  it('зміна: у журналі «було → стало»; іншу юрособу призначає лише головний адміністратор', async () => {
    await c.update(ID, { isActive: false } as never, DIRECTOR, 'le1');
    expect(journal()[0].diff).toEqual({ isActive: [true, false] });
    await expect(c.update(ID, { legalEntityId: 'le2' } as never, DIRECTOR, 'le1')).rejects.toThrow(
      'Юридичну особу не знайдено',
    );
  });

  it('чужий обліковий запис — «не знайдено»; вищий у своїй юрособі — «керує головний адміністратор»', async () => {
    users['findById'].mockResolvedValueOnce({ ...TARGET, legalEntityId: 'le2' });
    await expect(c.resetPassword(ID, DIRECTOR)).rejects.toThrow('Користувача не знайдено');
    users['findById'].mockResolvedValueOnce({ ...TARGET, role: 'ADMIN', legalEntityId: 'le1' });
    await expect(c.resetPassword(ID, DIRECTOR)).rejects.toThrow('керує головний адміністратор');
  });

  it('пароль, лист на зміну, розблокування, скидання коду — у журналі', async () => {
    await c.resetPassword(ID, ADMIN);
    await c.requestPasswordChange(ID, ADMIN);
    await c.unlock(ID, ADMIN);
    await c.resetMfa(ID, ADMIN, { ip: '10.0.0.1', headers: {}, socket: {} } as never);
    expect(mfa['reset']).toHaveBeenCalled();
    expect(journal().map((r) => r.action)).toEqual(['PASSWORD_RESET', 'USER_UPDATED', 'USER_UPDATED', 'MFA_CHANGED']);
    await c.list('le1');
    expect(users['list']).toHaveBeenCalledWith('le1');
  });
});
