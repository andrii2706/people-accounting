import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wire } from '../../test/wiring.js';
import type { KepVerifierService } from '../kep/kep-verifier.service.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { UploadGuardService } from '../security/upload-guard.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { UsersService } from '../users/users.service.js';
import { SignupRequest } from './signup-request.entity.js';
import { SignupService } from './signup.service.js';

/** A fictional company in the register and its fictional head. */
const COMPANY = {
  edrpou: '11223344',
  fullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ «УЯВНА»',
  shortName: 'ТОВ «УЯВНА»',
  address: 'м. Тестове, вул. Уявна, 7',
  postalCode: '01003',
  headName: 'Іван ВИГАДАНИЙ',
  headFullName: 'ВИГАДАНИЙ ІВАН ПЕТРОВИЧ',
  terminated: false,
  kved: '62.01',
  source: 'тестовий реєстр',
};
const CHECK = {
  signer: { fullName: 'Вигаданий Іван Петрович', drfoMasked: '12******90', edrpou: '', issuer: 'Тестовий КНЕДП' },
  level: 'QUALIFIED',
  der: Buffer.from('signature'),
};

let w: ReturnType<typeof wire>;
let kep: { available: boolean; verify: ReturnType<typeof vi.fn> };
let users: Record<string, ReturnType<typeof vi.fn>>;
let sendTo: ReturnType<typeof vi.fn>;
let stored: string[];
let service: SignupService;
const requests = () => w.db.getRepository<SignupRequest>(SignupRequest);

beforeEach(() => {
  w = wire();
  kep = { available: true, verify: vi.fn(async () => CHECK) };
  users = {
    emailTaken: vi.fn(async () => false),
    registerHead: vi.fn(async () => ({ id: 'u-new' })),
    adminEmails: vi.fn(async () => ['root@example.com']),
  };
  sendTo = vi.fn(async () => true);
  stored = [];
  vi.spyOn(w.legalEntities, 'lookup').mockResolvedValue(COMPANY);
  service = new SignupService(
    requests() as never,
    w.db.getRepository(LegalEntity) as never,
    kep as unknown as KepVerifierService,
    w.legalEntities,
    users as unknown as UsersService,
    { sendTo } as unknown as NotificationsService,
    { put: async (key: string) => stored.push(key) } as unknown as StorageService,
    w.audit,
    { assertSafe: vi.fn() } as unknown as UploadGuardService,
  );
  const env = (service as unknown as { env: object }).env;
  (service as unknown as { env: object }).env = {
    ...env,
    selfSignupEnabled: true,
    companyRegistryUrl: 'https://registry.example.com/{code}',
  };
});

async function statement(over: Record<string, unknown> = {}) {
  return service.statement({ edrpou: '11223344', email: ' Head@Example.com ', ...over } as never, '10.0.0.1');
}

describe('SignupService: заява', () => {
  it('вимкнено — «не знайдено»; увімкнено — інформація для форми', async () => {
    expect(service.info().enabled).toBe(true);
    (service as unknown as { env: object }).env = {
      ...(service as unknown as { env: object }).env,
      selfSignupEnabled: false,
    };
    await expect(statement()).rejects.toThrow('реєстрацію вимкнено');
  });

  it('заява з номером, кодом і email; бот (приховане поле) — одразу недійсна', async () => {
    const st = await statement();
    expect(Buffer.from(st.content, 'base64').toString()).toContain('11223344');
    expect(requests().rows[0]).toMatchObject({ email: 'head@example.com', status: 'PENDING' });
    expect(requests().rows[0].documentSha256).toHaveLength(64);
    await statement({ website: 'spam' });
    expect(requests().rows[1].status).toBe('EXPIRED');
  });
});

describe('SignupService.sign', () => {
  it('підписав керівник за ЄДР — юрособа з ЄДР, директор, доказ підпису збережено', async () => {
    const st = await statement();
    const res = await service.sign(st.id, Buffer.from('sig').toString('base64'));
    expect(res.message).toContain('тимчасовий пароль');
    const entity = w.db.getRepository<LegalEntity>(LegalEntity).rows.find((e) => e.edrpou === '11223344')!;
    expect(entity).toMatchObject({ shortName: 'ТОВ «УЯВНА»', billingRequired: true, headUserId: 'u-new' });
    expect(users.registerHead).toHaveBeenCalledWith('Вигаданий Іван Петрович', 'head@example.com', entity.id);
    expect(stored).toEqual([`signups/${st.id}/statement.txt`, `signups/${st.id}/statement.txt.p7s`]);
    expect(requests().rows[0]).toMatchObject({ status: 'APPROVED', signerName: 'Вигаданий Іван Петрович' });
    await expect(service.sign(st.id, 'x')).rejects.toThrow('Заява недійсна');
  });

  it('підписав не керівник — відмова 403, спроба збережена, лист адміністраторам', async () => {
    kep.verify.mockResolvedValue({ ...CHECK, signer: { ...CHECK.signer, fullName: 'Інша Особа' } });
    const st = await statement();
    await expect(service.sign(st.id, 'eA==')).rejects.toMatchObject({ response: { code: 'SIGNUP_REJECTED' } });
    expect(requests().rows[0]).toMatchObject({ status: 'REJECTED', reason: 'NOT_HEAD' });
    await vi.waitFor(() => expect(sendTo).toHaveBeenCalled());
    expect(sendTo.mock.calls[0][2]).toContain('Код ЄДРПОУ: 11223344');
  });

  it('інші причини відмови: код у сертифікаті, припинена, вже є, немає в ЄДР, недійсний підпис', async () => {
    const cases: [() => void, string][] = [
      [
        () => kep.verify.mockResolvedValue({ ...CHECK, signer: { ...CHECK.signer, edrpou: '99999999' } }),
        'CERT_EDRPOU_MISMATCH',
      ],
      [() => vi.spyOn(w.legalEntities, 'lookup').mockResolvedValue({ ...COMPANY, terminated: true }), 'TERMINATED'],
      [() => w.db.getRepository(LegalEntity).seed({ edrpou: '11223344', fullName: 'x' } as never), 'ENTITY_EXISTS'],
      [() => vi.spyOn(w.legalEntities, 'lookup').mockRejectedValue(new NotFoundException()), 'NOT_IN_REGISTRY'],
      [() => kep.verify.mockRejectedValue(new Error('bad cms')), 'SIGNATURE_INVALID'],
    ];
    for (const [arrange, reason] of cases) {
      w = wire();
      vi.spyOn(w.legalEntities, 'lookup').mockResolvedValue(COMPANY);
      kep.verify.mockResolvedValue(CHECK);
      (service as unknown as Record<string, unknown>).requests = requests();
      (service as unknown as Record<string, unknown>).entities = w.db.getRepository(LegalEntity);
      (service as unknown as Record<string, unknown>).legalEntities = w.legalEntities;
      (service as unknown as Record<string, unknown>).audit = w.audit;
      arrange();
      const st = await statement();
      await expect(service.sign(st.id, 'eA==')).rejects.toMatchObject({ response: { code: 'SIGNUP_REJECTED' } });
      expect(requests().rows[0].reason).toBe(reason);
    }
  });

  it('ЄДР чи бібліотека КЕП недоступні — заява лишається дійсною', async () => {
    const st = await statement();
    vi.spyOn(w.legalEntities, 'lookup').mockRejectedValueOnce(new ServiceUnavailableException());
    await expect(service.sign(st.id, 'eA==')).rejects.toThrow('ЄДР зараз не відповідає');
    kep.verify.mockRejectedValueOnce(new ServiceUnavailableException('КЕП недоступний'));
    await expect(service.sign(st.id, 'eA==')).rejects.toThrow('КЕП недоступний');
    expect(requests().rows[0].status).toBe('PENDING');
  });

  it('email уже зайнятий — підказка; строк заяви минув — нова', async () => {
    users.emailTaken.mockResolvedValueOnce(true);
    const st = await statement();
    await expect(service.sign(st.id, 'eA==')).rejects.toThrow('email уже використовується');
    requests().rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.sign(st.id, 'eA==')).rejects.toThrow('сформуйте нову');
    expect(requests().rows[0].status).toBe('EXPIRED');
  });

  it('список спроб для адміністратора: лише розглянуті', async () => {
    const ok = await statement();
    await service.sign(ok.id, 'eA==');
    await statement();
    const list = await service.list();
    expect(list.map((r) => r.status)).toEqual(['APPROVED']);
    expect(await service.refusedSince(new Date(0))).toEqual([]);
  });
});
