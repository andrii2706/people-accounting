import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { createPublicKey, generateKeyPairSync, type JsonWebKey } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SESSION_AUDIENCE, SESSION_ISSUER } from '../platform/contracts/session.js';

const JWT_SECRET = 'test-only-secret-0123456789abcdef-0123';

/** The cookie the service sets. */
function capture() {
  let token = '';
  const res = { cookie: (_name: string, value: string) => (token = value) } as unknown as Response;
  return { res, token: () => token };
}

const decode = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<string, unknown>;

describe('спільна сесія застосунків (ES256 + JWKS)', () => {
  let SessionService: typeof import('./session.service.js').SessionService;
  const jwt = new JwtService({ secret: JWT_SECRET, signOptions: { algorithm: 'HS256' } });
  const legacy = new JwtService({ secret: JWT_SECRET });

  beforeAll(async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    process.env['DATABASE_URL'] ??= 'postgres://test:test@localhost/test';
    process.env['JWT_SECRET'] = JWT_SECRET;
    process.env['SESSION_SIGNING_KEY'] = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    ({ SessionService } = await import('./session.service.js'));
  });

  it('сесія підписана ES256 і несе юрособу та застосунки', async () => {
    const sessions = new SessionService(jwt);
    const { res, token } = capture();
    await sessions.issue(res, {
      id: 'u1',
      role: 'HR',
      tokenVersion: 2,
      legalEntityId: 'le1',
      modules: ['oblik', 'kadry'],
    });
    const header = JSON.parse(Buffer.from(token().split('.')[0], 'base64url').toString()) as {
      alg: string;
      kid: string;
    };
    expect(header.alg).toBe('ES256');
    expect(decode(token())).toMatchObject({
      sub: 'u1',
      ent: 'le1',
      mods: ['oblik', 'kadry'],
      iss: SESSION_ISSUER,
      aud: SESSION_AUDIENCE,
    });
    expect(await sessions.verify(token())).toMatchObject({ sub: 'u1', ver: 2 });
  });

  it('головний адміністратор відкриває всі застосунки', async () => {
    const { res, token } = capture();
    await new SessionService(jwt).issue(res, { id: 'a1', role: 'ADMIN', tokenVersion: 0 });
    expect(decode(token()).mods).toEqual(['oblik', 'kadry', 'docs', 'time', 'logistics']);
  });

  it('інші застосунки перевіряють підпис відкритим ключем з JWKS', async () => {
    const sessions = new SessionService(jwt);
    const { res, token } = capture();
    await sessions.issue(res, { id: 'u1', role: 'HR', tokenVersion: 0 });
    const [jwk] = sessions.jwks().keys as (JsonWebKey & { kid: string })[];
    const header = JSON.parse(Buffer.from(token().split('.')[0], 'base64url').toString()) as { kid: string };
    expect(jwk.kid).toBe(header.kid);
    expect(jwk).not.toHaveProperty('d'); // only the public part
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' }).toString();
    await expect(new JwtService().verifyAsync(token(), { publicKey, algorithms: ['ES256'] })).resolves.toMatchObject({
      sub: 'u1',
    });
  });

  it('сесія, видана до ключа (HS256), діє до кінця строку', async () => {
    const old = await legacy.signAsync({ sub: 'u1', ver: 0, sst: Math.floor(Date.now() / 1000), role: 'HR' });
    await expect(new SessionService(jwt).verify(old)).resolves.toMatchObject({ sub: 'u1' });
  });

  it('підробка: ES256-токен, підписаний іншим ключем, — відмова', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const forged = await new JwtService().signAsync(
      { sub: 'u1', ver: 0, sst: 1, role: 'ADMIN' },
      {
        algorithm: 'ES256',
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        issuer: SESSION_ISSUER,
        audience: SESSION_AUDIENCE,
      },
    );
    await expect(new SessionService(jwt).verify(forged)).rejects.toThrow();
  });
});
