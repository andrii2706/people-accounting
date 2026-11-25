import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HR } from '../../test/fixtures.js';
import { FakeDb } from '../../test/fake-db.js';
import { AuditService } from '../audit/audit.service.js';
import type { BillingService } from '../billing/billing.service.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import type { SecurityService } from '../security/security.service.js';
import type { OfferGateService } from '../subscriptions/offer-gate.service.js';
import type { SubscriptionGateService } from '../subscriptions/subscription-gate.service.js';
import type { UsersService } from '../users/users.service.js';
import { AuthController } from './auth.controller.js';
import type { MfaService } from './mfa.service.js';
import type { SessionService } from './session.service.js';

/** A fictional HR account as the database returns it. */
const USER = {
  id: 'u-hr',
  email: 'hr@example.com',
  fullName: 'Тестова Ольга Петрівна',
  role: 'HR',
  legalEntityId: 'le1',
  isActive: true,
  tokenVersion: 1,
  modules: ['oblik'],
  mustChangePassword: false,
};

let db: FakeDb;
let users: Record<string, ReturnType<typeof vi.fn>>;
let sessions: Record<string, unknown>;
let mfa: Record<string, ReturnType<typeof vi.fn>>;
let security: Record<string, ReturnType<typeof vi.fn>>;
let billing: Record<string, ReturnType<typeof vi.fn>>;
let c: AuthController;

const req = (cookies: Record<string, string> = {}) =>
  ({ cookies, ip: '10.0.0.1', headers: { 'user-agent': 'Mozilla/5.0 Firefox/130' }, socket: {} }) as never;
const res = () => ({ cookie: vi.fn(), clearCookie: vi.fn() }) as never;
const journal = () => db.getRepository<AuditLog>(AuditLog).rows.map((r) => r.action);

beforeEach(() => {
  db = new FakeDb();
  users = {
    verifyCredentials: vi.fn(async () => ({ status: 'ok', user: USER })),
    findForSession: vi.fn(async () => USER),
    changeOwnPassword: vi.fn(async () => USER),
    passwordLinkInfo: vi.fn(async () => ({ email: USER.email })),
    resetWithLink: vi.fn(async () => USER),
    preferences: vi.fn(async () => ({ notify: true })),
    updatePreferences: vi.fn(async (_id: string, notify: boolean) => ({ notify })),
  };
  sessions = {
    cookieName: 'mr_session',
    issue: vi.fn(),
    clear: vi.fn(),
    jwks: vi.fn(() => ({ keys: [] })),
    verify: vi.fn(async () => ({ sub: 'u-hr', ver: 1, sst: 1, via: 'portal' })),
    isExpiredAbsolutely: vi.fn(() => false),
  };
  mfa = {
    nextStep: vi.fn(() => null),
    challenge: vi.fn(async (_u: unknown, step: string) => ({ twoFactor: step, ticket: 't' })),
    fromTicket: vi.fn(async () => USER),
    checkCode: vi.fn(async () => ({ status: 'ok' })),
    lockedError: vi.fn(() => new Error('Вхід заблоковано до 12:00')),
    begin: vi.fn(async () => ({ secret: 'ABCD' })),
    enable: vi.fn(async () => ['CODE-1']),
    status: vi.fn(async () => ({ enabled: true })),
    beginOwn: vi.fn(async () => ({ secret: 'ABCD' })),
    enableOwn: vi.fn(async () => ['CODE-1']),
    disable: vi.fn(async () => ({ enabled: false })),
    renewCodes: vi.fn(async () => ['CODE-2']),
  };
  security = { record: vi.fn(), checkLoginBurst: vi.fn(), trackDevice: vi.fn() };
  billing = { loginGate: vi.fn(), sessionGate: vi.fn(async () => ({ gate: 'ok', contact: '' })) };
  c = new AuthController(
    users as unknown as UsersService,
    sessions as unknown as SessionService,
    new AuditService(db.getRepository(AuditLog) as never),
    billing as unknown as BillingService,
    { accepted: vi.fn(async () => true) } as unknown as OfferGateService,
    mfa as unknown as MfaService,
    security as unknown as SecurityService,
    { gate: vi.fn(async () => 'OK') } as unknown as SubscriptionGateService,
  );
});

describe('AuthController.login', () => {
  it('правильний пароль без коду — сесія, журнал LOGIN, перевірка пристрою, звертання', async () => {
    const out = (await c.login({ email: USER.email, password: 'x' } as never, req(), res())) as { address: string };
    expect(sessions['issue']).toHaveBeenCalled();
    expect(journal()).toEqual(['LOGIN']);
    expect(security['trackDevice']).toHaveBeenCalled();
    expect(out.address).toBeTruthy();
    expect(billing['loginGate']).toHaveBeenCalled();
  });

  it('увімкнено код — лише квиток на другий крок', async () => {
    mfa['nextStep'].mockReturnValueOnce('CODE');
    expect(await c.login({ email: USER.email, password: 'x' } as never, req(), res())).toEqual({
      twoFactor: 'CODE',
      ticket: 't',
    });
    expect(sessions['issue']).not.toHaveBeenCalled();
  });

  it('хибний пароль — 401, журнал, перевірка серії з адреси', async () => {
    users['verifyCredentials'].mockResolvedValueOnce({ status: 'invalid', userId: 'u-hr' });
    await expect(c.login({ email: USER.email, password: 'x' } as never, req(), res())).rejects.toThrow(
      'Невірний email або пароль',
    );
    expect(journal()).toEqual(['LOGIN_FAILED']);
    expect(security['checkLoginBurst']).toHaveBeenCalledWith('10.0.0.1');
  });

  it('заблоковано — час розблокування; щойно — подія безпеки', async () => {
    users['verifyCredentials'].mockResolvedValueOnce({
      status: 'locked',
      userId: 'u-hr',
      lockedUntil: new Date('2026-11-24T10:00:00Z'),
      fresh: true,
    });
    await expect(c.login({ email: USER.email, password: 'x' } as never, req(), res())).rejects.toThrow(
      'Вхід заблоковано до 12:00',
    );
    expect(security['record']).toHaveBeenCalledWith('LOGIN_LOCKED', expect.objectContaining({ userId: 'u-hr' }));
  });

  it('тимчасовий пароль прострочено — підказка', async () => {
    users['verifyCredentials'].mockResolvedValueOnce({ status: 'expired', userId: 'u-hr' });
    await expect(c.login({ email: USER.email, password: 'x' } as never, req(), res())).rejects.toThrow('прострочено');
  });
});

describe('AuthController: другий крок', () => {
  it('код правильний — сесія; хибний — залишок спроб; заблоковано — помилка з часом', async () => {
    await c.loginCode({ ticket: 't', code: '123456' } as never, req(), res());
    expect(sessions['issue']).toHaveBeenCalledTimes(1);
    mfa['checkCode'].mockResolvedValueOnce({ status: 'invalid', left: 3 });
    await expect(c.loginCode({ ticket: 't', code: '1' } as never, req(), res())).rejects.toThrow('Залишилось спроб: 3');
    mfa['checkCode'].mockResolvedValueOnce({ status: 'locked', lockedUntil: new Date() });
    await expect(c.loginCode({ ticket: 't', code: '1' } as never, req(), res())).rejects.toThrow('Вхід заблоковано');
    expect(journal()).toEqual(['LOGIN', 'LOGIN_FAILED', 'LOCKED']);
  });

  it('перше налаштування коду при вході: QR, потім увімкнення й резервні коди', async () => {
    expect(await c.loginSetup({ ticket: 't' } as never)).toEqual({ secret: 'ABCD' });
    const out = await c.loginEnable({ ticket: 't', code: '123456' } as never, req(), res());
    expect(out.recoveryCodes).toEqual(['CODE-1']);
    expect(journal()).toContain('MFA_CHANGED');
  });
});

describe('AuthController: сесія', () => {
  it('session: без cookie, недійсна, змінена версія — user: null; інакше — користувач', async () => {
    expect(await c.session(req())).toEqual({ user: null });
    expect((await c.session(req({ mr_session: 'x' }))).user?.email).toBe(USER.email);
    users['findForSession'].mockResolvedValueOnce({ ...USER, tokenVersion: 2 });
    expect(await c.session(req({ mr_session: 'x' }))).toEqual({ user: null });
    (sessions['verify'] as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('bad'));
    expect(await c.session(req({ mr_session: 'x' }))).toEqual({ user: null });
  });

  it('me: звідки увійшли (портал); вихід; ключі JWKS', async () => {
    expect((await c.me(HR, req({ mr_session: 'x' }))).via).toBe('portal');
    c.logout(res());
    expect(sessions['clear']).toHaveBeenCalled();
    expect(c.jwks()).toEqual({ keys: [] });
  });

  it('access: що відкрито в модулі; без модуля — порожньо', async () => {
    const out = await c.access({ ...HR, modules: ['oblik'] } as never, req({ mr_session: 'x' }));
    expect(out.modules).toHaveLength(1);
    expect(await c.access({ ...HR, modules: ['kadry'] } as never, req())).toEqual({ modules: [] });
  });
});

describe('AuthController: паролі, код, налаштування', () => {
  it('зміна власного пароля: слабкий — помилка; інакше — нова сесія й журнал', async () => {
    await expect(
      c.changePassword({ currentPassword: 'x', newPassword: '1' } as never, HR, res()),
    ).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'newPassword' })] },
    });
    await c.changePassword({ currentPassword: 'x', newPassword: 'Other-Pass-2026!q' } as never, HR, res());
    expect(journal()).toEqual(['PASSWORD_CHANGED']);
  });

  it('посилання з листа: хто; новий пароль — сесії завершено', async () => {
    expect(await c.passwordLink('tok')).toEqual({ email: USER.email });
    expect(await c.resetPassword({ token: 'tok', newPassword: 'x' } as never, res())).toEqual({ email: USER.email });
    expect(sessions['clear']).toHaveBeenCalled();
  });

  it('власний код: стан, налаштувати, увімкнути, вимкнути, нові коди', async () => {
    await c.mfaStatus(HR);
    await c.mfaSetup({ password: 'x' } as never, HR);
    expect((await c.mfaEnable({ code: '1' } as never, HR, req())).recoveryCodes).toEqual(['CODE-1']);
    expect(await c.mfaDisable({ password: 'x', code: '1' } as never, HR, req())).toEqual({ enabled: false });
    expect((await c.mfaRecoveryCodes({ password: 'x', code: '1' } as never, HR, req())).recoveryCodes).toEqual([
      'CODE-2',
    ]);
    expect(journal().filter((a) => a === 'MFA_CHANGED')).toHaveLength(2);
  });

  it('нагадування на пошту', async () => {
    expect(await c.preferences(HR)).toEqual({ notify: true });
    expect(await c.updatePreferences(HR, { notify: false } as never)).toEqual({ notify: false });
  });
});
