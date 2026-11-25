import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '../../test/fake-db.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { SESSION_ISSUER, SSO_TICKET_TYPE } from '../platform/contracts/session.js';
import { User } from '../users/user.entity.js';
import type { SessionService } from './session.service.js';
import { SsoController } from './sso.controller.js';

// a throwaway key pair of the «portal» — only for this test
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function ticket(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: 'k1', ...header });
  const body = b64({
    iss: SESSION_ISSUER,
    aud: 'oblik',
    typ: SSO_TICKET_TYPE,
    exp: now + 60,
    jti: `j${Math.random()}`,
    email: 'hr@example.com',
    name: 'Тестова Ольга',
    role: 'HR',
    next: '/oblik/employees',
    ...claims,
  });
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString(
    'base64url',
  );
  return `${head}.${body}.${sig}`;
}

let db: FakeDb;
let issue: ReturnType<typeof vi.fn>;
let c: SsoController;
const res = () => ({ redirect: vi.fn() });
const req = { ip: '10.0.0.1', headers: {}, socket: {} } as never;

beforeEach(() => {
  db = new FakeDb();
  db.getRepository(LegalEntity).seed({ id: 'le1', fullName: 'ТОВ «Вигадана»', edrpou: '12345678' } as never);
  db.getRepository(User).qb({ getOne: () => db.getRepository(User).rows[0] ?? null });
  issue = vi.fn();
  process.env['PORTAL_JWKS_URL'] = 'https://portal.example.com/api/auth/.well-known/jwks.json';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ keys: [JWK] }) })),
  );
  c = new SsoController(
    { issue } as unknown as SessionService,
    db.dataSource as never,
    new AuditService(db.getRepository(AuditLog) as never),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['PORTAL_JWKS_URL'];
});

describe('SsoController — вхід з порталу', () => {
  it('дійсний квиток: новий обліковий запис з порталу (юрособа за ЄДРПОУ), сесія, перехід', async () => {
    const r = res();
    await c.sso(ticket({ company: { code: '12345678' } }), req, r as never);
    const [user] = db.getRepository<User>(User).rows;
    expect(user).toMatchObject({ email: 'hr@example.com', role: 'HR', legalEntityId: 'le1', modules: ['oblik'] });
    expect(issue).toHaveBeenCalledWith(r, expect.objectContaining({ email: 'hr@example.com' }), undefined, 'portal');
    expect(r.redirect).toHaveBeenCalledWith(302, '/oblik/employees');
    expect(db.getRepository<AuditLog>(AuditLog).rows[0].action).toBe('LOGIN');
  });

  it('квиток використовується один раз', async () => {
    const t = ticket();
    await c.sso(t, req, res() as never);
    const again = res();
    await c.sso(t, req, again as never);
    expect(again.redirect).toHaveBeenCalledWith(302, '/oblik/login?reason=sso&sso=used');
  });

  it('відмова: прострочений, чужий модуль, підробка, інший алгоритм, без email, вимкнений запис', async () => {
    const bad = [
      ticket({ exp: 1 }),
      ticket({ aud: 'kadry' }),
      ticket({}, { alg: 'HS256' }),
      ticket({ email: '' }),
      `${ticket().slice(0, -4)}AAAA`,
      'not-a-jwt',
    ];
    const pages: string[] = [];
    for (const t of bad) {
      const r = res();
      await c.sso(t, req, r as never);
      pages.push(r.redirect.mock.calls[0][1]);
    }
    // a refused ticket — the sign-in of THIS module (not the portal: that looked like a reload) with the reason
    expect(pages).toEqual([
      '/oblik/login?reason=sso&sso=expired',
      '/oblik/login?reason=sso&sso=invalid',
      '/oblik/login?reason=sso&sso=invalid',
      '/oblik/login?reason=sso&sso=invalid',
      '/oblik/login?reason=sso&sso=invalid',
      '/login?reason=sso&sso=invalid',
    ]);
    db.getRepository(User).seed({ email: 'hr@example.com', isActive: false } as never);
    const r = res();
    await c.sso(ticket(), req, r as never);
    expect(r.redirect).toHaveBeenCalledWith(302, '/oblik/login?reason=sso&sso=account');
    expect(issue).not.toHaveBeenCalled();
  });

  it('без PORTAL_JWKS_URL вхід з порталу вимкнено; «next» на інший сайт — на головну модуля', async () => {
    const t = ticket({ next: '//evil.example.com/' });
    delete process.env['PORTAL_JWKS_URL'];
    const off = res();
    await c.sso(t, req, off as never);
    expect(off.redirect).toHaveBeenCalledWith(302, '/login?reason=sso&sso=off');
    process.env['PORTAL_JWKS_URL'] = 'https://portal.example.com/jwks';
    const r = res();
    await c.sso(t, req, r as never);
    expect(r.redirect).toHaveBeenCalledWith(302, '/');
  });

  it('ключі порталу недоступні (не той порт, портал не запущено) — «keys», причина в журналі', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
      }),
    );
    const r = res();
    await c.sso(ticket(), req, r as never);
    expect(r.redirect).toHaveBeenCalledWith(302, '/oblik/login?reason=sso&sso=keys');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    const notFound = res();
    await c.sso(ticket(), req, notFound as never);
    expect(notFound.redirect).toHaveBeenCalledWith(302, '/oblik/login?reason=sso&sso=keys');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ keys: [{ ...JWK, kid: 'other' }] }) })),
    );
    const unknown = res();
    await c.sso(ticket(), req, unknown as never);
    expect(unknown.redirect).toHaveBeenCalledWith(302, '/oblik/login?reason=sso&sso=keys');
  });
});
