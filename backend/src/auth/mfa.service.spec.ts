import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '../../test/fake-db.js';
import type { SecurityService } from '../security/security.service.js';
import { User } from '../users/user.entity.js';
import { MfaService } from './mfa.service.js';
import { base32Decode, hotp, totpStep } from './utils/totp.utils.js';

const PASSWORD = 'Fict-Pass-2026!q';
let db: FakeDb;
let record: ReturnType<typeof vi.fn>;
let service: MfaService;
const users = () => db.getRepository<User>(User);
const codeFor = (secret: string, step = totpStep()) => hotp(base32Decode(secret.replace(/\s/g, '')), step);
const ACTOR = { ip: '10.0.0.1' };

async function account(over: Partial<User> = {}) {
  return users().seed({
    id: 'u1',
    email: 'hr@example.com',
    fullName: 'Тестова Ольга',
    role: 'HR',
    legalEntityId: 'le1',
    isActive: true,
    tokenVersion: 1,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    mfaRecoveryHashes: [],
    mfaFailedCount: 0,
    ...over,
  } as never)[0];
}

/** An account with the code turned on — through the service itself, as a person does it. */
async function enabled() {
  const u = await account();
  const setup = await service.begin(users().rows[0] as User);
  const codes = await service.enable(users().rows[0] as User, codeFor(setup.secret), ACTOR);
  users().rows[0].mfaLastStep = null; // the next code in the same 30 s must pass too
  return { u, secret: setup.secret.replace(/\s/g, ''), codes };
}

beforeEach(() => {
  db = new FakeDb();
  record = vi.fn();
  service = new MfaService(users() as never, new JwtService(), { record } as unknown as SecurityService);
});

describe('MfaService: налаштування коду', () => {
  it('begin: секрет групами по 4, QR-матриця; секрет збережено, ще не увімкнено', async () => {
    await account();
    const setup = await service.begin(users().rows[0] as User);
    expect(setup.secret).toMatch(/^([A-Z2-7]{4} )+[A-Z2-7]{1,4}$/);
    expect(setup.otpauthUrl).toContain('otpauth://totp/');
    expect(setup.qr.cells).toHaveLength(setup.qr.size ** 2);
    expect(users().rows[0].mfaSecret).toBe(setup.secret.replace(/\s/g, ''));
  });

  it('enable: перший правильний код вмикає, 10 резервних кодів; хибний — помилка біля поля', async () => {
    await account();
    const setup = await service.begin(users().rows[0] as User);
    await expect(service.enable(users().rows[0] as User, '000000', ACTOR)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'code' })] },
    });
    const codes = await service.enable(users().rows[0] as User, codeFor(setup.secret), ACTOR);
    expect(codes).toHaveLength(10);
    expect(users().rows[0].mfaEnabledAt).toBeInstanceOf(Date);
    expect(users().rows[0].mfaRecoveryHashes).toHaveLength(10);
    expect(record).toHaveBeenCalledWith('MFA_ENABLED', expect.objectContaining({ userId: 'u1' }));
    await expect(service.begin(users().rows[0] as User)).rejects.toThrow('уже увімкнено');
  });

  it('nextStep: увімкнено — CODE; обов’язково для ролі — SETUP; інакше — нічого', () => {
    expect(service.nextStep({ role: 'HR', mfaEnabledAt: new Date() } as User)).toBe('CODE');
    const roles = (service as unknown as { env: { mfaRequiredRoles: string[] } }).env.mfaRequiredRoles;
    const free = ['HR', 'DIRECTOR', 'ADMIN', 'ENTITY_ADMIN'].find((r) => !roles.includes(r));
    if (roles[0]) expect(service.nextStep({ role: roles[0], mfaEnabledAt: null } as never)).toBe('SETUP');
    if (free) expect(service.nextStep({ role: free, mfaEnabledAt: null } as never)).toBeNull();
  });
});

describe('MfaService.checkCode — другий крок входу', () => {
  it('код з телефону — ok; той самий вдруге — ні (повтор)', async () => {
    const { secret } = await enabled();
    const code = codeFor(secret);
    expect(await service.checkCode(users().rows[0] as User, code, ACTOR)).toEqual({ status: 'ok' });
    const again = await service.checkCode({ ...users().rows[0] } as User, code, ACTOR);
    expect(again.status).toBe('invalid');
  });

  it('резервний код — один раз; лишок рахується', async () => {
    const { codes } = await enabled();
    const res = await service.checkCode(users().rows[0] as User, codes[0], ACTOR);
    expect(res).toEqual({ status: 'recovery', left: 9 });
    expect(record).toHaveBeenCalledWith('MFA_RECOVERY_USED', expect.anything(), { left: 9 });
    expect((await service.checkCode({ ...users().rows[0] } as User, codes[0], ACTOR)).status).toBe('invalid');
  });

  it('5 хибних кодів — блокування і подія MFA_LOCKED', async () => {
    await enabled();
    let res;
    for (let i = 0; i < 5; i++) res = await service.checkCode({ ...users().rows[0] } as User, '111111', ACTOR);
    expect(res).toMatchObject({ status: 'locked' });
    expect(record).toHaveBeenCalledWith('MFA_LOCKED', expect.anything(), { failures: 5 });
    expect(service.lockedError(new Date()).message).toContain('Вхід заблоковано до');
  });

  it('без увімкненого коду — invalid', async () => {
    await account();
    expect(await service.checkCode(users().rows[0] as User, '123456', ACTOR)).toEqual({ status: 'invalid', left: 0 });
  });
});

describe('MfaService: квиток між паролем і кодом', () => {
  it('дійсний квиток — обліковий запис; інший крок, зміна пароля, підробка — «час минув»', async () => {
    await account();
    const { ticket } = await service.challenge({ id: 'u1', tokenVersion: 1 }, 'CODE');
    expect((await service.fromTicket(ticket, 'CODE')).id).toBe('u1');
    await expect(service.fromTicket(ticket, 'SETUP')).rejects.toThrow('Час на введення коду минув');
    await expect(service.fromTicket('forged', 'CODE')).rejects.toThrow('Час на введення коду минув');
    users().rows[0].tokenVersion = 2;
    await expect(service.fromTicket(ticket, 'CODE')).rejects.toThrow('Час на введення коду минув');
  });

  it('заблокований — повідомлення з часом', async () => {
    await account({ lockedUntil: new Date(Date.now() + 600_000) });
    const { ticket } = await service.challenge({ id: 'u1', tokenVersion: 1 }, 'CODE');
    await expect(service.fromTicket(ticket, 'CODE')).rejects.toThrow('Вхід заблоковано');
  });
});

describe('MfaService: власні дії й адміністратор', () => {
  it('beginOwn: потрібен пароль', async () => {
    await account();
    await expect(service.beginOwn('u1', 'wrong')).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'password' })] },
    });
    expect((await service.beginOwn('u1', PASSWORD)).secret).toBeTruthy();
    await expect(service.beginOwn('nope', PASSWORD)).rejects.toThrow('не знайдено');
  });

  it('enableOwn і status', async () => {
    await account();
    const setup = await service.beginOwn('u1', PASSWORD);
    await service.enableOwn('u1', codeFor(setup.secret), ACTOR);
    expect(await service.status('u1')).toMatchObject({ enabled: true, recoveryLeft: 10 });
  });

  it('renewCodes: пароль + код → нові коди; хибний код — помилка', async () => {
    const { secret } = await enabled();
    await expect(service.renewCodes('u1', PASSWORD, '000000', ACTOR)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ field: 'code' })] },
    });
    const codes = await service.renewCodes('u1', PASSWORD, codeFor(secret), ACTOR);
    expect(codes).toHaveLength(10);
    expect(record).toHaveBeenCalledWith('MFA_CODES_RENEWED', expect.anything());
  });

  it('disable: де роль не вимагає — вимикає; без увімкненого — помилка', async () => {
    const { secret } = await enabled();
    const roles = (service as unknown as { env: { mfaRequiredRoles: string[] } }).env.mfaRequiredRoles;
    if (roles.includes('HR')) {
      await expect(service.disable('u1', PASSWORD, codeFor(secret), ACTOR)).rejects.toThrow('обов’язковий');
    } else {
      const status = await service.disable('u1', PASSWORD, codeFor(secret), ACTOR);
      expect(status.enabled).toBe(false);
      await expect(service.disable('u1', PASSWORD, '000000', ACTOR)).rejects.toThrow('не увімкнено');
    }
  });

  it('reset адміністратором: код знято, сесії завершено, подія з іменем адміністратора', async () => {
    await enabled();
    await service.reset('u1', { id: 'a1', fullName: 'Адміністратор' }, ACTOR);
    expect(users().rows[0]).toMatchObject({ mfaEnabledAt: null, mfaSecret: null, tokenVersion: 2 });
    expect(record).toHaveBeenCalledWith('MFA_RESET', expect.anything(), { by: 'Адміністратор' });
    await expect(service.reset('nope', { id: 'a1', fullName: 'x' }, ACTOR)).rejects.toThrow('не знайдено');
  });
});
