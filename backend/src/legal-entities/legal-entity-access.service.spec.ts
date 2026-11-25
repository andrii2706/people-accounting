import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN } from '../../test/fixtures.js';
import { wire } from '../../test/wiring.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { User } from '../users/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import { LegalEntityAccessService } from './legal-entity-access.service.js';
import { LegalEntity } from './legal-entity.entity.js';

let w: ReturnType<typeof wire>;
let users: Record<string, ReturnType<typeof vi.fn>>;
let service: LegalEntityAccessService;
const entities = () => w.db.getRepository<LegalEntity>(LegalEntity);
const accounts = () => w.db.getRepository<User>(User);

beforeEach(() => {
  w = wire();
  users = {
    findByEmail: vi.fn(
      async (email: string) => accounts().rows.find((u) => u.email === email.trim().toLowerCase()) ?? null,
    ),
    assignEntity: vi.fn(async (id: string, le: string) => {
      accounts().rows.find((u) => u.id === id)!.legalEntityId = le;
    }),
    update: vi.fn(async (id: string, dto: Partial<User>) =>
      Object.assign(
        accounts().rows.find((u) => u.id === id)!,
        dto,
      ),
    ),
    createWithTemporaryPassword: vi.fn(
      async (email: string, fullName: string, role: string, _by: AuthUser, ctx: { legalEntityId: string }) => {
        const [user] = accounts().seed({
          email,
          fullName,
          role,
          legalEntityId: ctx.legalEntityId,
          isActive: true,
        } as never);
        return { user, temporaryPassword: 'Tmp-0000-x', mailSent: true, expiresAt: new Date() };
      },
    ),
  };
  service = new LegalEntityAccessService(entities() as never, users as unknown as UsersService);
});

describe('LegalEntityAccessService.grant', () => {
  it('новий обліковий запис керівника: директор, тимчасовий пароль один раз, прив’язано до юрософи', async () => {
    const out = await service.grant('le1', 'HEAD', { email: 'head@example.com' } as never, ADMIN);
    expect(out.temporaryPassword).toBe('Tmp-0000-x');
    expect(users.createWithTemporaryPassword).toHaveBeenCalledWith(
      'head@example.com',
      'Вигаданий Директор Тестович',
      'DIRECTOR',
      ADMIN,
      expect.objectContaining({ legalEntityId: 'le1', entityCode: '12345678' }),
    );
    expect(entities().rows[0].headUserId).toBe(out.access.userId);
    const people = await service.people('le1');
    expect(people.HEAD?.email).toBe('head@example.com');
    expect(people.RESPONSIBLE).toBeNull();
  });

  it('відповідальний — роль кадровика; без ПІБ — спершу вказати; доступ уже є — спершу скасувати', async () => {
    await service.grant('le1', 'RESPONSIBLE', { email: 'resp@example.com' } as never, ADMIN);
    expect(users.createWithTemporaryPassword.mock.calls[0][2]).toBe('HR');
    await expect(service.grant('le1', 'RESPONSIBLE', { email: 'x@example.com' } as never, ADMIN)).rejects.toThrow(
      'вже є доступ',
    );
    await expect(service.grant('le2', 'HEAD', { email: 'x@example.com' } as never, ADMIN)).rejects.toThrow(
      'Спершу вкажіть',
    );
  });

  it('наявний обліковий запис: прив’язати й увімкнути; чужої юрософи чи адміністратора — ні', async () => {
    accounts().seed(
      {
        id: 'u-free',
        email: 'free@example.com',
        fullName: 'Вільний',
        role: 'HR',
        legalEntityId: null,
        isActive: false,
      } as never,
      {
        id: 'u-other',
        email: 'other@example.com',
        fullName: 'Чужий',
        role: 'HR',
        legalEntityId: 'le2',
        isActive: true,
      } as never,
      {
        id: 'u-root',
        email: 'root@example.com',
        fullName: 'Адмін',
        role: 'ADMIN',
        legalEntityId: null,
        isActive: true,
      } as never,
    );
    const out = await service.grant('le1', 'RESPONSIBLE', { email: 'free@example.com' } as never, ADMIN);
    expect(out.temporaryPassword).toBeNull();
    expect(users.assignEntity).toHaveBeenCalledWith('u-free', 'le1');
    expect(users.update).toHaveBeenCalledWith('u-free', { isActive: true }, 'u-free');
    await expect(service.grant('le1', 'HEAD', { email: 'other@example.com' } as never, ADMIN)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ message: expect.stringContaining('іншій юридичній особі') })] },
    });
    await expect(service.grant('le1', 'HEAD', { email: 'root@example.com' } as never, ADMIN)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ message: 'Цю адресу не можна використати' })] },
    });
    await expect(service.people('nope')).rejects.toThrow('Юридичну особу не знайдено');
  });
});

describe('LegalEntityAccessService.revoke / change / adoptByDirector', () => {
  it('revoke: обліковий запис вимкнено; власний — не можна; немає доступу — «немає»', async () => {
    const out = await service.grant('le1', 'HEAD', { email: 'head@example.com' } as never, ADMIN);
    const self = { ...ADMIN, id: out.access.userId } as AuthUser;
    await expect(service.revoke('le1', 'HEAD', self)).rejects.toThrow('власний доступ');
    entities().qb({ getMany: [] });
    expect(await service.revoke('le1', 'HEAD', ADMIN)).toEqual({ deactivated: true, email: 'head@example.com' });
    expect(entities().rows[0].headUserId).toBeNull();
    await expect(service.revoke('le1', 'HEAD', ADMIN)).rejects.toThrow('немає доступу');
  });

  it('revoke: та сама людина ще й у іншій юрособі — лише відв’язано', async () => {
    const out = await service.grant('le1', 'RESPONSIBLE', { email: 'resp@example.com' } as never, ADMIN);
    entities().qb({ getMany: [{ id: 'le2' }] });
    expect(await service.revoke('le1', 'RESPONSIBLE', ADMIN)).toEqual({
      deactivated: false,
      email: 'resp@example.com',
    });
    expect(users.update).not.toHaveBeenCalledWith(out.access.userId, { isActive: false }, expect.anything());
  });

  it('change: нова людина — дані замінено, попередній доступ скасовано, новому видано', async () => {
    await service.grant('le1', 'RESPONSIBLE', { email: 'resp@example.com' } as never, ADMIN);
    entities().qb({ getMany: [] });
    const out = await service.change(
      'le1',
      'RESPONSIBLE',
      {
        fullName: ' Нова Відповідальна ',
        position: ' Інспектор ',
        phone: '0501112233',
        email: 'new@example.com',
        revokePrevious: true,
      } as never,
      ADMIN,
    );
    expect(out.revoked?.deactivated).toBe(true);
    expect(out.granted?.access.email).toBe('new@example.com');
    expect(entities().rows[0]).toMatchObject({
      responsibleName: 'Нова Відповідальна',
      responsiblePosition: 'Інспектор',
    });
    expect(entities().rows[0].responsiblePhone).toMatch(/^\+380/);
  });

  it('adoptByDirector: юрособа директора, він керівник; самореєстрація — за підпискою', async () => {
    accounts().seed({
      id: 'u-dir',
      email: 'd@example.com',
      fullName: 'Директор Самореєстрований',
      role: 'DIRECTOR',
      legalEntityId: null,
    } as never);
    await service.adoptByDirector('le2', {
      id: 'u-dir',
      fullName: 'Директор Самореєстрований',
      signupSource: 'SELF',
    } as AuthUser);
    expect(entities().rows[1]).toMatchObject({
      headUserId: 'u-dir',
      headName: 'Директор Самореєстрований',
      billingRequired: true,
    });
  });
});
