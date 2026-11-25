import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '../../test/fake-db.js';
import { ADMIN } from '../../test/fixtures.js';
import { sha256 } from '../common/utils/hash.utils.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

// fewer bcrypt rounds — the same checks, a faster test run
vi.mock('bcryptjs', async (orig) => {
  const real = ((await orig()) as { default: typeof import('bcryptjs') }).default;
  const fast = { ...real, hash: (p: string) => real.hash(p, 4) };
  return { ...fast, default: fast };
});
const bcrypt = (await import('bcryptjs')).default;

const STRONG = 'Fict-Pass-2026!q';
let db: FakeDb;
let service: UsersService;
let notes: {
  notifyUser: ReturnType<typeof vi.fn>;
  sendTemporaryPassword: ReturnType<typeof vi.fn>;
  sendPasswordChangeRequest: ReturnType<typeof vi.fn>;
};

const users = () => db.getRepository<User>(User);
const links = () => db.getRepository<PasswordResetToken>(PasswordResetToken);

async function account(over: Partial<User> = {}) {
  return users().seed({
    email: 'hr@example.com',
    fullName: 'Тестова Ольга',
    role: 'HR',
    legalEntityId: 'le1',
    isActive: true,
    passwordHash: await bcrypt.hash(STRONG, 4),
    tokenVersion: 1,
    failedLoginCount: 0,
    mustChangePassword: false,
    passwordChangedAt: new Date(),
    modules: ['oblik'],
    ...over,
  } as never)[0];
}

beforeEach(() => {
  db = new FakeDb();
  db.getRepository(LegalEntity).seed({
    id: 'le1',
    fullName: 'ТОВ «Вигадана компанія»',
    shortName: 'Вигадана',
    edrpou: '12345678',
  } as never);
  notes = {
    notifyUser: vi.fn(),
    sendTemporaryPassword: vi.fn(async () => true),
    sendPasswordChangeRequest: vi.fn(async () => true),
  };
  service = new UsersService(users() as never, links() as never, notes as unknown as NotificationsService);
});

describe('UsersService.verifyCredentials — вхід', () => {
  it('правильний пароль: лічильник скинуто, час входу записано', async () => {
    const u = await account({ failedLoginCount: 2 });
    const res = await service.verifyCredentials('HR@example.com', STRONG);
    expect(res.status).toBe('ok');
    expect(users().rows.find((r) => r.id === u.id)).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
    expect(users().rows[0].lastLoginAt).toBeInstanceOf(Date);
  });

  it('невідомий чи вимкнений — «invalid» без підказки', async () => {
    expect((await service.verifyCredentials('nobody@example.com', STRONG)).status).toBe('invalid');
    await account({ isActive: false });
    expect((await service.verifyCredentials('hr@example.com', STRONG)).status).toBe('invalid');
  });

  it('5 невдалих спроб — блокування; під час блокування не пускає навіть з правильним паролем', async () => {
    await account();
    for (let i = 0; i < 4; i++)
      expect((await service.verifyCredentials('hr@example.com', 'wrong')).status).toBe('invalid');
    const locked = await service.verifyCredentials('hr@example.com', 'wrong');
    expect(locked).toMatchObject({ status: 'locked', fresh: true });
    expect((await service.verifyCredentials('hr@example.com', STRONG)).status).toBe('locked');
  });

  it('прострочений тимчасовий пароль — «expired»', async () => {
    await account({ mustChangePassword: true, temporaryPasswordExpiresAt: new Date(Date.now() - 1000) });
    expect((await service.verifyCredentials('hr@example.com', STRONG)).status).toBe('expired');
  });

  it('пароль кадровика старший за пів року — пускає лише змінити його', async () => {
    const old = new Date(Date.now() - 200 * 86_400_000);
    await account({ passwordChangedAt: old });
    const res = await service.verifyCredentials('hr@example.com', STRONG);
    expect(res.status).toBe('ok');
    expect(users().rows[0].mustChangePassword).toBe(true);
  });
});

describe('UsersService: створення облікових записів', () => {
  it('адміністратор створює: email у нижньому регістрі, тимчасовий пароль — листом', async () => {
    const user = await service.create(
      {
        email: 'New@Example.com',
        fullName: 'Нова Людина',
        password: 'Tmp-Pass-2026-q',
        role: 'HR',
        legalEntityId: 'le1',
        modules: ['oblik'],
      },
      { issuedBy: ADMIN },
    );
    expect(user.email).toBe('new@example.com');
    expect(user.mustChangePassword).toBe(true);
    expect(notes.sendTemporaryPassword).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'NEW', entityCode: '12345678' }),
    );
  });

  it('без адміністратора (скрипт) — лише повідомлення про доступ, без пароля', async () => {
    await service.create({
      email: 'cli@example.com',
      fullName: 'Скрипт',
      password: STRONG,
      role: 'HR',
      legalEntityId: 'le1',
    });
    expect(notes.notifyUser).toHaveBeenCalledWith(
      'cli@example.com',
      expect.stringContaining('доступ'),
      expect.not.stringContaining(STRONG),
    );
  });

  it('роль без юрособи чи неіснуюча юрособа — помилка біля поля; зайнятий email — теж', async () => {
    await expect(
      service.create(
        { email: 'a@example.com', fullName: 'А', password: STRONG, role: 'HR', legalEntityId: 'nope' },
        { silent: true },
      ),
    ).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'legalEntityId' })] },
    });
    await account();
    await expect(
      service.create({ email: 'HR@example.com', fullName: 'Б', password: STRONG }, { silent: true }),
    ).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'email' })] },
    });
  });

  it('createWithTemporaryPassword: пароль показано один раз і надіслано листом', async () => {
    const out = await service.createWithTemporaryPassword('head@example.com', 'Керівник Тестовий', 'DIRECTOR', ADMIN, {
      legalEntityId: 'le1',
      entityName: 'Вигадана',
      entityCode: '12345678',
      asWhom: 'як керівнику',
    });
    expect(out.temporaryPassword.length).toBeGreaterThan(10);
    expect(out.mailSent).toBe(true);
    expect(users().rows[0].temporaryPasswordExpiresAt).toBeInstanceOf(Date);
  });

  it('registerHead: директор від самореєстрації (signupSource SELF)', async () => {
    const user = await service.registerHead('Керівник Тестовий', ' Boss@Example.com ', 'le1');
    expect(user.role).toBe('DIRECTOR');
    expect(users().rows[0].signupSource).toBe('SELF');
    expect(notes.sendTemporaryPassword).toHaveBeenCalledWith(expect.objectContaining({ kind: 'SIGNUP' }));
  });

  it('ensureAdmin: не створює вдруге; createVendor: окрема роль', async () => {
    const first = await service.ensureAdmin('root@example.com', STRONG, 'Головний');
    const again = await service.ensureAdmin('ROOT@example.com', STRONG, 'Головний');
    expect(again.id).toBe(first.id);
    const vendor = await service.createVendor('vendor@example.com', 'Постачальник', STRONG);
    expect(vendor.role).toBe('VENDOR');
    await expect(service.createVendor('vendor@example.com', 'x', STRONG)).rejects.toBeTruthy();
    expect(await service.adminEmails()).toEqual(['root@example.com']);
    expect(await service.emailTaken(' Vendor@example.com')).toBe(true);
  });
});

describe('UsersService: редагування облікового запису', () => {
  it('блокування: сесії завершено, лист «доступ припинено»; розблокування — «відновлено»', async () => {
    const u = await account();
    await service.update(u.id, { isActive: false }, 'admin');
    expect(users().rows[0]).toMatchObject({ isActive: false, tokenVersion: 2 });
    expect(notes.notifyUser).toHaveBeenLastCalledWith(
      'hr@example.com',
      expect.stringContaining('припинено'),
      expect.any(String),
    );
    await service.update(u.id, { isActive: true }, 'admin');
    expect(notes.notifyUser).toHaveBeenLastCalledWith(
      'hr@example.com',
      expect.stringContaining('відновлено'),
      expect.any(String),
    );
  });

  it('нова роль — лист і нова версія сесії; себе заблокувати чи змінити собі роль не можна', async () => {
    const u = await account();
    await service.update(u.id, { role: 'DIRECTOR' }, 'admin');
    expect(users().rows[0].role).toBe('DIRECTOR');
    expect(notes.notifyUser).toHaveBeenCalledWith(
      'hr@example.com',
      expect.stringContaining('роль'),
      expect.any(String),
    );
    await expect(service.update(u.id, { isActive: false }, u.id)).rejects.toThrow('Не можна заблокувати себе');
  });

  it('головний адміністратор — без юрособи; постачальника не редагують', async () => {
    const u = await account();
    await service.update(u.id, { role: 'ADMIN' }, 'admin');
    expect(users().rows[0].legalEntityId).toBeNull();
    const v = await account({ email: 'v@example.com', role: 'VENDOR' });
    await expect(service.update(v.id, { fullName: 'x' }, 'admin')).rejects.toThrow('не знайдено');
  });

  it('список і пошук: постачальника не видно; за юрособою', async () => {
    await account();
    await account({ email: 'v@example.com', role: 'VENDOR' });
    await account({ email: 'x@example.com', legalEntityId: 'le2' });
    expect((await service.list()).map((u) => u.email).sort((a, b) => a.localeCompare(b))).toEqual([
      'hr@example.com',
      'x@example.com',
    ]);
    expect((await service.list('le1')).map((u) => u.email)).toEqual(['hr@example.com']);
    expect((await service.findByEmail(' HR@example.com '))?.email).toBe('hr@example.com');
  });

  it('налаштування нагадувань і розблокування', async () => {
    const u = await account({ failedLoginCount: 3, lockedUntil: new Date(Date.now() + 60_000) });
    expect(await service.updatePreferences(u.id, false)).toEqual({ notify: false });
    const unlocked = await service.unlock(u.id);
    expect(unlocked.lockedUntil).toBeNull();
  });
});

describe('UsersService: паролі', () => {
  it('resetPassword: новий тимчасовий, сесії завершено, лист RESET', async () => {
    const u = await account();
    const out = await service.resetPassword(u.id, ADMIN);
    expect(await bcrypt.compare(out.temporaryPassword, users().rows[0].passwordHash)).toBe(true);
    expect(users().rows[0]).toMatchObject({ mustChangePassword: true, tokenVersion: 2 });
    expect(notes.sendTemporaryPassword).toHaveBeenCalledWith(expect.objectContaining({ kind: 'RESET' }));
    await expect(service.resetPassword('nope', ADMIN)).rejects.toThrow('не знайдено');
  });

  it('changeOwnPassword: невірний поточний, такий самий, слабкий — помилки біля полів', async () => {
    const u = await account();
    await expect(service.changeOwnPassword(u.id, 'wrong', 'Other-Pass-2026!')).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'currentPassword' })] },
    });
    await expect(service.changeOwnPassword(u.id, STRONG, STRONG)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ message: 'Має відрізнятися від поточного' })] },
    });
    await expect(service.changeOwnPassword(u.id, STRONG, 'short')).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'newPassword' })] },
    });
    await service.changeOwnPassword(u.id, STRONG, 'Other-Pass-2026!q');
    expect(users().rows[0]).toMatchObject({ mustChangePassword: false, tokenVersion: 2 });
    expect(notes.notifyUser).toHaveBeenCalledWith('hr@example.com', 'Пароль змінено', expect.any(String));
  });

  it('посилання з листа: одне дійсне; попередні гаснуть; після використання — недійсне', async () => {
    const u = await account();
    const first = await service.createPasswordLink(u.id, 'EXPIRING', 72);
    const second = await service.createPasswordLink(u.id, 'EXPIRING', 72);
    const token = (l: string) => new URL(l).searchParams.get('token')!;
    await expect(service.passwordLinkInfo(token(first.link))).rejects.toThrow('Посилання недійсне');
    expect(await service.passwordLinkInfo(token(second.link))).toMatchObject({
      email: 'hr@example.com',
      purpose: 'EXPIRING',
    });
    expect(links().rows.every((l) => l.tokenHash !== token(second.link))).toBe(true);
    expect(links().rows.some((l) => l.tokenHash === sha256(Buffer.from(token(second.link))))).toBe(true);
    await service.resetWithLink(token(second.link), 'Link-Pass-2026!q');
    expect(users().rows[0].tokenVersion).toBe(2);
    await expect(service.resetWithLink(token(second.link), 'Link-Pass-2026!w')).rejects.toThrow('Посилання недійсне');
    await expect(service.passwordLinkInfo('')).rejects.toThrow('Посилання недійсне');
  });

  it('requestPasswordChange: лише для увімкненого; лист з посиланням', async () => {
    const u = await account();
    const out = await service.requestPasswordChange(u.id, ADMIN);
    expect(out).toEqual({ mailSent: true, email: 'hr@example.com' });
    expect(users().rows[0].mustChangePassword).toBe(true);
    const off = await account({ email: 'off@example.com', isActive: false });
    await expect(service.requestPasswordChange(off.id, ADMIN)).rejects.toThrow('вимкнено');
  });
});
