import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PasswordResetToken } from './password-reset-token.entity.js';
import type { User } from './user.entity.js';
import { UsersService } from './users.service.js';

// loadEnv() runs in the service: a minimal development configuration (no real secrets)
process.env['DATABASE_URL'] ??= 'postgres://test:test@localhost/test';
process.env['JWT_SECRET'] ??= 'test-only-secret-0123456789abcdef-0123';

/** A fictional HR account. */
const HR = {
  id: 'u1',
  email: 'hr@example.com',
  fullName: 'Тестова Ольга',
  role: 'HR',
  legalEntityId: 'le1',
  isActive: true,
  tokenVersion: 3,
} as User;

function setup(taken: string[] = []) {
  const update = vi.fn();
  const repo = {
    exists: async ({ where }: { where: { email: string } }) => taken.includes(where.email),
    update,
  } as unknown as Repository<User>;
  const mails: string[] = [];
  const notifications = {
    notifyUser: async (email: string) => mails.push(email),
  } as unknown as NotificationsService;
  const service = new UsersService(repo, {} as Repository<PasswordResetToken>, notifications);
  vi.spyOn(service as unknown as { findWithSecrets: () => Promise<User> }, 'findWithSecrets').mockResolvedValue({
    ...HR,
  });
  vi.spyOn(service, 'findById').mockResolvedValue({ ...HR });
  return { service, update, mails };
}

describe('редагування користувача', () => {
  it('виправлене ім’я — без зайвих пробілів', async () => {
    const { service, update } = setup();
    await service.update('u1', { fullName: '  Тестова   Олена ' }, 'admin');
    expect(update).toHaveBeenCalledWith('u1', { fullName: 'Тестова Олена' });
  });

  it('новий email: у нижньому регістрі, сесії завершено, лист на обидві адреси', async () => {
    const { service, update, mails } = setup();
    await service.update('u1', { email: ' New.HR@Example.com ' }, 'admin');
    expect(update).toHaveBeenCalledWith('u1', { email: 'new.hr@example.com', tokenVersion: 4 });
    expect(mails).toEqual(['hr@example.com', 'new.hr@example.com']);
  });

  it('зайнятий email — помилка біля поля', async () => {
    const { service, update } = setup(['taken@example.com']);
    await expect(service.update('u1', { email: 'taken@example.com' }, 'admin')).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'email' })] },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('той самий email і ім’я — нічого не змінюється', async () => {
    const { service, update, mails } = setup();
    await service.update('u1', { email: 'HR@example.com', fullName: 'Тестова Ольга' }, 'admin');
    expect(update).not.toHaveBeenCalled();
    expect(mails).toEqual([]);
  });
});

describe('створення користувача адміністратором', () => {
  it('тимчасовий пароль з кириличною літерою чи пробілом — помилка біля поля, обліковий запис не створено', async () => {
    const save = vi.fn();
    const repo = { exists: async () => false, save, create: (u: unknown) => u } as unknown as Repository<User>;
    const service = new UsersService(repo, {} as Repository<PasswordResetToken>, {} as NotificationsService);
    for (const password of ['Sony\u0430h#Lis2026q', 'Sonyah#Lis2026q '])
      await expect(
        service.create(
          { email: 'olena@example.test', fullName: 'Олена Вигадана', password, role: 'ADMIN' },
          { issuedBy: { id: 'admin', role: 'ADMIN' } as never },
        ),
      ).rejects.toMatchObject({ response: { errors: [expect.objectContaining({ field: 'password' })] } });
    expect(save).not.toHaveBeenCalled();
  });
});
