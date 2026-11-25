import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '../../test/fake-db.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { User } from '../users/user.entity.js';
import { ExportUsage } from './entities/export-usage.entity.js';
import { SecurityEvent } from './entities/security-event.entity.js';
import { UserDevice } from './entities/user-device.entity.js';
import { SecurityService } from './security.service.js';

let db: FakeDb;
let sendTo: ReturnType<typeof vi.fn>;
let service: SecurityService;
const events = () => db.getRepository<SecurityEvent>(SecurityEvent);

beforeEach(() => {
  db = new FakeDb();
  db.getRepository(User).seed(
    {
      id: 'u1',
      email: 'hr@example.com',
      fullName: 'Тестова Ольга',
      role: 'HR',
      legalEntityId: 'le1',
      isActive: true,
    } as never,
    {
      id: 'u2',
      email: 'boss@example.com',
      fullName: 'Керівник',
      role: 'DIRECTOR',
      legalEntityId: 'le1',
      isActive: true,
    } as never,
    {
      id: 'u3',
      email: 'root@example.com',
      fullName: 'Адмін',
      role: 'ADMIN',
      legalEntityId: null,
      isActive: true,
    } as never,
    {
      id: 'u4',
      email: 'other@example.com',
      fullName: 'Інший',
      role: 'DIRECTOR',
      legalEntityId: 'le2',
      isActive: true,
    } as never,
  );
  sendTo = vi.fn(async () => true);
  service = new SecurityService(
    events() as never,
    db.getRepository(UserDevice) as never,
    db.getRepository(ExportUsage) as never,
    db.getRepository(AuditLog) as never,
    db.getRepository(User) as never,
    { sendTo } as unknown as NotificationsService,
  );
});

describe('SecurityService.record', () => {
  it('блокування входу: людині й керівникам її юрософи + головним адміністраторам; не чужим', async () => {
    const event = await service.record('LOGIN_LOCKED', {
      userId: 'u1',
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130',
    });
    expect(event?.notified).toBe(true);
    expect(event?.userName).toBe('Тестова Ольга');
    const to = sendTo.mock.calls[0][0] as string[];
    expect(to.sort((a, b) => a.localeCompare(b))).toEqual(['boss@example.com', 'hr@example.com', 'root@example.com']);
  });

  it('повтор у тиші: один рядок з лічильником, без другого листа', async () => {
    await service.record('LOGIN_LOCKED', { userId: 'u1', ip: '10.0.0.1' });
    await service.record('LOGIN_LOCKED', { userId: 'u1', ip: '10.0.0.1' });
    expect(events().rows).toHaveLength(1);
    expect(events().rows[0].details.repeats).toBe(2);
    expect(sendTo).toHaveBeenCalledTimes(1);
  });

  it('новий пристрій — лише людині; пошта не працює — подію записано без «надіслано»', async () => {
    sendTo.mockResolvedValueOnce(false);
    const event = await service.record('NEW_DEVICE', {
      userId: 'u1',
      email: 'hr@example.com',
      userName: 'x',
      legalEntityId: 'le1',
    });
    expect(sendTo.mock.calls[0][0]).toEqual(['hr@example.com']);
    expect(event?.notified).toBe(false);
  });

  it('збій бази — null, без винятку', async () => {
    vi.spyOn(events(), 'save').mockRejectedValueOnce(new Error('db down'));
    expect(await service.record('MFA_ENABLED', { userId: 'u1' })).toBeNull();
  });
});

describe('SecurityService.trackDevice', () => {
  const res = () => ({ cookie: vi.fn() });
  const req = (cookie?: string) => ({
    cookies: cookie ? { mr_device: cookie } : {},
    ip: '::ffff:10.0.0.5',
    headers: { 'user-agent': 'Mozilla/5.0 Firefox/130' },
  });

  it('перший браузер облікового запису — без листа; новий — лист; знайомий — лише «востаннє»', async () => {
    const user = { id: 'u1', fullName: 'Тестова Ольга', email: 'hr@example.com', legalEntityId: 'le1' };
    const r1 = res();
    await service.trackDevice(user, req() as never, r1 as never);
    const cookie = r1.cookie.mock.calls[0][1] as string;
    expect(sendTo).not.toHaveBeenCalled();
    expect(db.getRepository(UserDevice).rows[0].lastIp).toBe('10.0.0.5');
    await service.trackDevice(user, req() as never, res() as never);
    expect(sendTo).toHaveBeenCalledTimes(1);
    const name = (service as unknown as { env: { deviceCookieName: string } }).env.deviceCookieName;
    await service.trackDevice(user, { ...req(), cookies: { [name]: cookie } } as never, res() as never);
    expect(db.getRepository(UserDevice).rows).toHaveLength(2);
    expect(sendTo).toHaveBeenCalledTimes(1);
  });
});

describe('SecurityService: перевірки', () => {
  it('серія невдалих входів у різні облікові записи — LOGIN_BURST', async () => {
    db.getRepository(AuditLog).qb({ getRawOne: { failures: '30', accounts: '8' } });
    await service.checkLoginBurst('10.0.0.9');
    expect(events().rows[0]).toMatchObject({ kind: 'LOGIN_BURST', ip: '10.0.0.9' });
    await service.checkLoginBurst('');
    expect(events().rows).toHaveLength(1);
  });

  it('мало невдалих — нічого', async () => {
    db.getRepository(AuditLog).qb({ getRawOne: { failures: '2', accounts: '1' } });
    await service.checkLoginBurst('10.0.0.9');
    expect(events().rows).toHaveLength(0);
  });

  it('масовий перегляд карток за годину — MASS_VIEW', async () => {
    const limit = (service as unknown as { env: { massViewPerHour: number } }).env.massViewPerHour;
    db.getRepository(AuditLog).seed(
      ...Array.from({ length: limit }, () => ({ userId: 'u1', action: 'VIEW', entity: 'employee', diff: {} }) as never),
    );
    await service.checkViews({ id: 'u1', fullName: 'Тестова Ольга', legalEntityId: 'le1' });
    expect(events().rows[0]?.kind).toBe('MASS_VIEW');
  });
});

describe('SecurityService: вивантаження, журнал, очищення', () => {
  it('ліміти вивантажень і пошук за SHA-256 у межах юрософи', async () => {
    await service.recordExport({
      userId: 'u1',
      legalEntityId: 'le1',
      fileName: 'Списки.docx',
      sha256: 'ABC',
      ip: '10.0.0.1',
    } as never);
    expect(await service.exportsSince('u1')).toEqual({ hour: 1, day: 1 });
    db.getRepository(ExportUsage).rows[0].sha256 = 'abc';
    const found = await service.trace('ABC', 'le1');
    expect(found).toEqual([expect.objectContaining({ userName: 'Тестова Ольга', fileName: 'Списки.docx' })]);
    expect(await service.trace('abc', 'le2')).toEqual([]);
  });

  it('журнал: своя юрособа, сторінки; старі рядки видаляються', async () => {
    await service.record('MFA_ENABLED', { userId: 'u1', legalEntityId: 'le1' });
    await service.record('MFA_ENABLED', { userId: 'u4', legalEntityId: 'le2' });
    const page = await service.list('le1', { size: 500 });
    expect(page.total).toBe(1);
    expect(page.items[0].title).toBeTruthy();
    expect((await service.list(null, { kind: 'MFA_ENABLED' })).total).toBe(2);
    events().rows[0].createdAt = new Date('2000-01-01');
    expect(await service.purge()).toEqual({ events: 1, exports: 0 });
  });
});
