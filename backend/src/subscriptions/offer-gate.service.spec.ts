import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import { loadEnv } from '../config/env.js';
import type { KepVerifierService } from '../kep/kep-verifier.service.js';
import type { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { OfferGateService } from './offer-gate.service.js';

// loadEnv() runs in the constructor: a minimal development configuration (no real secrets)
process.env['DATABASE_URL'] ??= 'postgres://test:test@localhost/test';
process.env['JWT_SECRET'] ??= 'test-only-secret-0123456789abcdef-0123';

const user = { role: 'HR' as const, legalEntityId: 'le1' };

function gate(selfRegistered: boolean, scope: 'all' | 'self', kepOn = true) {
  const entities = {
    findOne: async () => ({ id: 'le1', offerVersion: null, billingRequired: selfRegistered }),
  } as unknown as Repository<LegalEntity>;
  const service = new OfferGateService(entities, { available: kepOn } as KepVerifierService);
  (service as unknown as { env: ReturnType<typeof loadEnv> }).env = { ...loadEnv(), offerRequiredFor: scope };
  return service;
}

describe('чи вимагати оферту', () => {
  it('без перевірки КЕП оферта не вимагається', async () => {
    expect(await gate(true, 'all', false).accepted(user)).toBe(true);
  });

  it('OFFER_REQUIRED_FOR=self: юрособа, створена адміністратором, працює як раніше', async () => {
    expect(await gate(false, 'self').accepted(user)).toBe(true);
  });

  it('OFFER_REQUIRED_FOR=self: юрособа, що зареєструвалась сама, має підписати оферту', async () => {
    expect(await gate(true, 'self').accepted(user)).toBe(false);
  });

  it('OFFER_REQUIRED_FOR=all: підписати мають усі юрособи', async () => {
    expect(await gate(false, 'all').accepted(user)).toBe(false);
  });
});
