import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '../../../test/fake-db.js';
import type { SessionService } from '../../auth/session.service.js';
import type { BillingService } from '../../billing/billing.service.js';
import type { OfferGateService } from '../../subscriptions/offer-gate.service.js';
import type { SubscriptionGateService } from '../../subscriptions/subscription-gate.service.js';
import { User } from '../../users/user.entity.js';
import {
  ALLOW_PENDING_PASSWORD,
  ALLOW_UNASSIGNED,
  ALLOW_UNPAID,
  ALLOW_VENDOR,
  IDENTITY_ROUTE,
  IS_PUBLIC,
  ROLES,
} from '../constants/auth.constants.js';
import { AuthGuard } from './auth.guard.js';

let db: FakeDb;
let meta: Record<string, unknown>;
let sessions: Record<string, ReturnType<typeof vi.fn> | string>;
let gate: { gate: ReturnType<typeof vi.fn> };
let billing: { sessionGate: ReturnType<typeof vi.fn> };
let offers: { accepted: ReturnType<typeof vi.fn> };
let guard: AuthGuard;
const PAYLOAD = { sub: 'u1', ver: 1, sst: 1, via: 'password' };

function context(cookies: Record<string, string> = { mr_session: 'token' }) {
  const req: Record<string, unknown> = { cookies };
  const res = {};
  const ctx = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function account(over: Partial<User> = {}) {
  db.getRepository(User).seed({
    id: 'u1',
    email: 'hr@example.com',
    fullName: 'Тестова Ольга',
    role: 'HR',
    legalEntityId: 'le1',
    isActive: true,
    tokenVersion: 1,
    mustChangePassword: false,
    passwordChangedAt: new Date(),
    modules: ['oblik'],
    ...over,
  } as never);
}

beforeEach(() => {
  db = new FakeDb();
  meta = {};
  sessions = {
    cookieName: 'mr_session',
    verify: vi.fn(async () => PAYLOAD),
    isExpiredAbsolutely: vi.fn(() => false),
    clear: vi.fn(),
    shouldRefresh: vi.fn(() => false),
    issue: vi.fn(),
  };
  gate = { gate: vi.fn(async () => 'OK') };
  billing = { sessionGate: vi.fn(async () => ({ gate: 'ok', contact: '' })) };
  offers = { accepted: vi.fn(async () => true) };
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  guard = new AuthGuard(
    sessions as unknown as SessionService,
    reflector,
    db.getRepository(User) as never,
    gate as unknown as SubscriptionGateService,
    offers as unknown as OfferGateService,
    billing as unknown as BillingService,
  );
});

const code = (p: Promise<unknown>) =>
  p.then(() => 'passed').catch((e: { response?: { code?: string }; message: string }) => e.response?.code ?? e.message);

describe('AuthGuard: сесія', () => {
  it('публічний маршрут — без сесії', async () => {
    meta[IS_PUBLIC] = true;
    expect(await guard.canActivate(context({}).ctx)).toBe(true);
  });

  it('без cookie, підроблений чи прострочений токен — 401 і cookie прибрано', async () => {
    expect(await code(guard.canActivate(context({}).ctx))).toBe('Потрібна авторизація');
    (sessions.verify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('bad'));
    expect(await code(guard.canActivate(context().ctx))).toContain('Сесія завершилась');
    expect(sessions.clear).toHaveBeenCalled();
  });

  it('заблокований чи змінений пароль (інша версія) — 401', async () => {
    account({ tokenVersion: 2 });
    expect(await code(guard.canActivate(context().ctx))).toContain('Сесія недійсна');
  });

  it('усе гаразд: користувач у запиті; ковзне подовження сесії', async () => {
    account();
    (sessions.shouldRefresh as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    const { ctx, req } = context();
    expect(await guard.canActivate(ctx)).toBe(true);
    expect((req.user as { email: string }).email).toBe('hr@example.com');
    expect(sessions.issue).toHaveBeenCalled();
  });
});

describe('AuthGuard: обмеження доступу', () => {
  it('модуль не підключено — 403 MODULE_NOT_CONNECTED, крім маршрутів входу', async () => {
    account({ modules: ['kadry'] });
    expect(await code(guard.canActivate(context().ctx))).toBe('MODULE_NOT_CONNECTED');
    meta[IDENTITY_ROUTE] = true;
    expect(await code(guard.canActivate(context().ctx))).toBe('passed');
  });

  it('тимчасовий пароль — лише зміна пароля', async () => {
    account({ mustChangePassword: true });
    expect(await code(guard.canActivate(context().ctx))).toBe('PASSWORD_CHANGE_REQUIRED');
    meta[ALLOW_PENDING_PASSWORD] = true;
    expect(await code(guard.canActivate(context().ctx))).toBe('passed');
  });

  it('пароль кадровика старший за пів року — далі лише зміна пароля', async () => {
    account({ passwordChangedAt: new Date(Date.now() - 400 * 86_400_000) });
    expect(await code(guard.canActivate(context().ctx))).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(db.getRepository(User).rows[0].mustChangePassword).toBe(true);
  });

  it('оферту не підписано — TERMS_REQUIRED', async () => {
    account();
    offers.accepted.mockResolvedValue(false);
    expect(await code(guard.canActivate(context().ctx))).toBe('TERMS_REQUIRED');
  });

  it('постачальник — лише сторінка оплати', async () => {
    account({ role: 'VENDOR', legalEntityId: null });
    expect(await code(guard.canActivate(context().ctx))).toContain('постачальника');
    meta[ALLOW_VENDOR] = true;
    expect(await code(guard.canActivate(context().ctx))).toBe('passed');
  });

  it('без юрособи: директор — «додайте свою», кадровик — «зверніться до адміністратора»', async () => {
    account({ role: 'DIRECTOR', legalEntityId: null });
    expect(await code(guard.canActivate(context().ctx))).toBe('NO_LEGAL_ENTITY');
    meta[ALLOW_UNASSIGNED] = true;
    expect(await code(guard.canActivate(context().ctx))).toBe('passed');
  });

  it('підписка: тариф не обрано / строк минув; дозволені без оплати маршрути', async () => {
    account();
    gate.gate.mockResolvedValue('PLAN_REQUIRED');
    expect(await code(guard.canActivate(context().ctx))).toBe('PLAN_REQUIRED');
    gate.gate.mockResolvedValue('EXPIRED');
    expect(await code(guard.canActivate(context().ctx))).toBe('SUBSCRIPTION_EXPIRED');
    meta[ALLOW_UNPAID] = true;
    expect(await code(guard.canActivate(context().ctx))).toBe('passed');
  });

  it('борг за користування — BILLING_DEBT', async () => {
    account();
    billing.sessionGate.mockResolvedValue({ gate: 'blocked', contact: 'pay@example.com' });
    expect(await code(guard.canActivate(context().ctx))).toBe('BILLING_DEBT');
  });

  it('ролі маршруту: не та роль — «Недостатньо прав»', async () => {
    account();
    meta[ROLES] = ['ADMIN'];
    expect(await code(guard.canActivate(context().ctx))).toBe('Недостатньо прав');
    meta[ROLES] = ['HR'];
    expect(await code(guard.canActivate(context().ctx))).toBe('passed');
  });

  it('головний адміністратор — без юрософи й підписки', async () => {
    account({ role: 'ADMIN', legalEntityId: null, modules: [] });
    expect(await code(guard.canActivate(context().ctx))).toBe('passed');
    expect(gate.gate).not.toHaveBeenCalled();
  });
});
