import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wire } from '../../test/wiring.js';
import { User } from '../users/user.entity.js';
import type { MailService } from './mail.service.js';
import { NotificationLog } from './notification-log.entity.js';
import { NotificationsService } from './notifications.service.js';

let w: ReturnType<typeof wire>;
let mail: Record<string, ReturnType<typeof vi.fn> | boolean>;
let service: NotificationsService;

beforeEach(() => {
  w = wire();
  w.db.getRepository(User).seed(
    { id: 'u1', email: 'hr1@example.com', role: 'HR', legalEntityId: 'le1', isActive: true, notify: true } as never,
    { id: 'u2', email: 'off@example.com', role: 'HR', legalEntityId: 'le1', isActive: true, notify: false } as never,
    {
      id: 'u3',
      email: 'admin@example.com',
      role: 'ADMIN',
      legalEntityId: null,
      isActive: true,
      notify: true,
    } as never,
    { id: 'u4', email: 'other@example.com', role: 'HR', legalEntityId: 'le2', isActive: true, notify: true } as never,
    {
      id: 'u5',
      email: 'blocked@example.com',
      role: 'HR',
      legalEntityId: 'le1',
      isActive: false,
      notify: true,
    } as never,
  );
  mail = {
    configured: true,
    accessConfigured: true,
    send: vi.fn(async () => true),
    sendLetter: vi.fn(async () => true),
    sendAccess: vi.fn(async () => true),
  };
  service = new NotificationsService(
    w.db.getRepository(User) as never,
    w.db.getRepository(NotificationLog) as never,
    mail as unknown as MailService,
    w.legalEntities,
  );
});

describe('NotificationsService.recipients', () => {
  it('юрособа: її активні з увімкненими нагадуваннями, адміністратори, додаткові адреси — без повторів', async () => {
    const to = await service.recipients('le1');
    expect(to).toHaveLength(4);
    expect(to).toEqual(
      expect.arrayContaining(['admin@example.com', 'boss@example.com', 'hr1@example.com', 'hr@example.com']),
    );
  });

  it('для всіх: кожен активний обліковий запис і адреси всіх юросіб', async () => {
    const all = await service.recipients(null);
    expect(all).toContain('other@example.com');
    expect(all).not.toContain('blocked@example.com');
    expect(all).not.toContain('off@example.com');
  });
});

describe('NotificationsService: надсилання ніколи не ламає операцію', () => {
  it('notifyUsers: кількість адресатів; помилка пошти — 0', async () => {
    expect(await service.notifyUsers('Тема', 'Текст', 'le1')).toBe(4);
    (mail.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('smtp down'));
    expect(await service.notifyUsers('Тема', 'Текст', 'le1')).toBe(0);
    (mail.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    expect(await service.notifyUsers('Тема', 'Текст')).toBe(0);
  });

  it('notifyUsersLetter: HTML-лист тим самим адресатам', async () => {
    expect(await service.notifyUsersLetter({ subject: 'Квота', html: '<p>x</p>', text: 'x' }, 'le1')).toBe(4);
    (mail.sendLetter as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'));
    expect(await service.notifyUsersLetter({ subject: 'Квота', html: '', text: '' }, 'le1')).toBe(0);
  });

  it('notifyUser і sendTo: помилку проковтнуто', async () => {
    (mail.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'));
    await expect(service.notifyUser('a@example.com', 's', 't')).resolves.toBeUndefined();
    expect(await service.sendTo(['a@example.com'], 's', 't')).toBe(false);
  });

  it('лист з тимчасовим паролем: звертання, роль, юрособа', async () => {
    const ok = await service.sendTemporaryPassword({
      email: 'new@example.com',
      fullName: 'Тестова Ольга Петрівна',
      role: 'HR',
      temporaryPassword: 'Tmp-0000-x',
      expiresAt: new Date('2026-11-25T10:00:00Z'),
      kind: 'CREATED',
      issuedBy: { fullName: 'Адміністратор Тестовий', email: 'admin@example.com' },
    } as never);
    expect(ok).toBe(true);
    const [to, letter] = (mail.sendAccess as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(to).toBe('new@example.com');
    expect(letter.text).toContain('Tmp-0000-x');
    (mail.sendAccess as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'));
    expect(await service.sendTemporaryPassword({ email: 'x', fullName: 'X', role: 'HR', issuedBy: {} } as never)).toBe(
      false,
    );
  });

  it('листи про пароль: нагадування й запит на зміну — з юрособою облікового запису', async () => {
    w.db.getRepository(User).rows[0].legalEntityId = 'le1';
    const base = {
      userId: 'u1',
      email: 'hr1@example.com',
      fullName: 'Тестова Ольга',
      link: 'https://example.com/x',
      linkExpiresAt: new Date(),
    };
    expect(await service.sendPasswordExpiring({ ...base, passwordExpiresAt: new Date() })).toBe(true);
    expect((mail.sendAccess as ReturnType<typeof vi.fn>).mock.calls[0][1].text).toContain('12345678');
    expect(
      await service.sendPasswordChangeRequest({ ...base, issuedBy: { fullName: 'Адмін', email: 'admin@example.com' } }),
    ).toBe(true);
    (mail.sendAccess as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'));
    expect(await service.sendPasswordExpiring({ ...base, passwordExpiresAt: new Date() })).toBe(false);
    expect(
      await service.sendPasswordChangeRequest({ ...base, issuedBy: { fullName: 'А', email: 'a@example.com' } }),
    ).toBe(false);
  });

  it('журнал надісланого: wasSent / markSent; тестовий лист', async () => {
    w.db
      .getRepository(NotificationLog)
      .seed({ kind: 'DEFERRAL', refId: 'e1', refDate: '2026-11-01', recipients: 2 } as never);
    expect(await service.wasSent('DEFERRAL', 'e1', '2026-11-01')).toBe(true);
    expect(await service.wasSent('DEFERRAL', 'e1', '2026-11-02')).toBe(false);
    await expect(service.markSent('DEFERRAL', [], 1)).resolves.toBeUndefined();
    await expect(service.markSent('DEFERRAL', [{ refId: 'e2', refDate: '2026-11-01' }], 1)).resolves.toBeUndefined();
    expect(await service.test('me@example.com')).toBe(true);
    expect(service.mailConfigured).toBe(true);
    expect(service.accessMailConfigured).toBe(true);
  });
});
