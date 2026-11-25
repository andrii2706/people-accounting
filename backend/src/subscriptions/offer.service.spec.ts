import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wire } from '../../test/wiring.js';
import type { KepVerifierService } from '../kep/kep-verifier.service.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { UploadGuardService } from '../security/upload-guard.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type { StorageService } from '../storage/storage.service.js';
import { OfferSignature } from './offer-signature.entity.js';
import { OfferGateService } from './offer-gate.service.js';
import { OfferService } from './offer.service.js';
import type { SubscriptionsService } from './subscriptions.service.js';
import { TERMS_VERSION } from './terms.constants.js';

const DIRECTOR = {
  id: 'u-dir',
  email: 'boss@example.com',
  fullName: 'Вигаданий Директор Тестович',
  role: 'DIRECTOR',
  legalEntityId: 'le1',
} as AuthUser;
const SIGNER = {
  fullName: 'Вигаданий Директор Тестович',
  drfoMasked: '12******90',
  edrpou: '',
  issuer: 'Тестовий КНЕДП',
};

let w: ReturnType<typeof wire>;
let kep: { verify: ReturnType<typeof vi.fn> };
let stored: string[];
let service: OfferService;
const rows = () => w.db.getRepository<OfferSignature>(OfferSignature);

beforeEach(() => {
  w = wire();
  w.db.getRepository<LegalEntity>(LegalEntity).rows[0].billingRequired = true;
  // the head in the card is written as in a signature: «Ім’я ПРІЗВИЩЕ»
  w.db.getRepository<LegalEntity>(LegalEntity).rows[0].headName = 'Директор ВИГАДАНИЙ';
  kep = { verify: vi.fn(async () => ({ signer: SIGNER, level: 'QUALIFIED', der: Buffer.from('p7s') })) };
  stored = [];
  const gate = new OfferGateService(
    w.db.getRepository(LegalEntity) as never,
    { available: true } as unknown as KepVerifierService,
  );
  service = new OfferService(
    rows() as never,
    w.db.getRepository(LegalEntity) as never,
    {
      terms: async () => ({ version: TERMS_VERSION, title: 'Оферта', intro: 'Вступ', sections: [], seller: {} }),
    } as unknown as SubscriptionsService,
    w.legalEntities,
    kep as unknown as KepVerifierService,
    gate,
    { put: async (key: string) => stored.push(key) } as unknown as StorageService,
    w.audit,
    { assertSafe: vi.fn() } as unknown as UploadGuardService,
  );
  const env = (service as unknown as { env: object }).env;
  (service as unknown as { env: object }).env = { ...env, companyRegistryUrl: '' };
});

describe('OfferService', () => {
  it('статус до підпису: потрібно, не підписано, керівник може підписати', async () => {
    const st = await service.status(DIRECTOR);
    expect(st).toMatchObject({
      version: TERMS_VERSION,
      signed: false,
      canSign: true,
      entityName: 'ТОВ «Вигадана компанія»',
    });
  });

  it('документ → підпис керівника → підписано, доказ збережено, у журналі OFFER_SIGNED', async () => {
    const doc = await service.document(DIRECTOR);
    expect(Buffer.from(doc.content, 'base64').toString()).toContain('Оферта');
    const st = await service.sign(DIRECTOR, doc.id, Buffer.from('sig').toString('base64'));
    expect(st).toMatchObject({ signed: true, signerName: SIGNER.fullName });
    expect(stored).toEqual([`offers/le1/${doc.id}.txt`, `offers/le1/${doc.id}.txt.p7s`]);
    expect(w.db.getRepository<LegalEntity>(LegalEntity).rows[0].offerVersion).toBe(TERMS_VERSION);
    expect((await service.sign(DIRECTOR, doc.id, 'eA==')).signed).toBe(true);
  });

  it('підписав не керівник чи ключ іншої організації — пояснення', async () => {
    const doc = await service.document(DIRECTOR);
    kep.verify.mockResolvedValueOnce({
      signer: { ...SIGNER, fullName: 'Інша Особа' },
      level: 'QUALIFIED',
      der: Buffer.from('x'),
    });
    await expect(service.sign(DIRECTOR, doc.id, 'eA==')).rejects.toThrow('Оферту підписує керівник');
    kep.verify.mockResolvedValueOnce({
      signer: { ...SIGNER, edrpou: '99999999' },
      level: 'QUALIFIED',
      der: Buffer.from('x'),
    });
    await expect(service.sign(DIRECTOR, doc.id, 'eA==')).rejects.toThrow('іншій організації');
  });

  it('кадровик не підписує; без керівника в картці — спершу заповнити; стара редакція — сформувати знову', async () => {
    await expect(service.document({ ...DIRECTOR, role: 'HR' })).rejects.toThrow('підписує керівник');
    const doc = await service.document(DIRECTOR);
    rows().rows[0].termsVersion = 'old';
    await expect(service.sign(DIRECTOR, doc.id, 'eA==')).rejects.toThrow('Оферта оновилася');
    await expect(service.sign(DIRECTOR, 'nope', 'eA==')).rejects.toThrow('Документ не знайдено');
    w.db.getRepository<LegalEntity>(LegalEntity).rows[0].headName = '';
    await expect(service.document(DIRECTOR)).rejects.toThrow('не вказано керівника');
    await expect(service.document({ ...DIRECTOR, legalEntityId: null })).rejects.toThrow('додайте юридичну особу');
  });
});
