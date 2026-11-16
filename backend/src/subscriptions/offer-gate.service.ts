import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { loadEnv } from '../config/env.js';
import { KepVerifierService } from '../kep/kep-verifier.service.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { GATE_CACHE_MS } from './subscriptions.constants.js';
import { TERMS_EXEMPT_ROLES, TERMS_VERSION } from './terms.constants.js';

/**
 * Has the legal entity of the user accepted the current offer (signed by the head with KEP)?
 * Asked by the AuthGuard on every request; kept for a minute per instance, forgotten at once on signing.
 * Until a KEP check is configured the offer is not required — so a new version can be deployed safely.
 * OFFER_REQUIRED_FOR=self — only the legal entities that registered themselves must sign it
 * (those created by an administrator keep working as before).
 */
@Injectable()
export class OfferGateService {
  private readonly env = loadEnv();
  private readonly cache = new Map<string, { version: string | null; selfRegistered: boolean; at: number }>();

  constructor(
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly kep: KepVerifierService,
  ) {}

  /**
   * The offer is required for this user: works in a legal entity, KEP check configured and — with
   * OFFER_REQUIRED_FOR=self — the legal entity registered itself (`selfRegistered`).
   */
  required(user: Pick<AuthUser, 'role' | 'legalEntityId'>, selfRegistered: boolean): boolean {
    if (!this.kep.available || !user.legalEntityId || TERMS_EXEMPT_ROLES.includes(user.role)) return false;
    return this.env.offerRequiredFor === 'all' || selfRegistered;
  }

  async accepted(user: Pick<AuthUser, 'role' | 'legalEntityId'>): Promise<boolean> {
    if (!this.required(user, true)) return true;
    const entity = await this.entity(user.legalEntityId!);
    if (!this.required(user, entity.selfRegistered)) return true;
    return entity.version === TERMS_VERSION;
  }

  private async entity(legalEntityId: string) {
    const hit = this.cache.get(legalEntityId);
    if (hit && Date.now() - hit.at < GATE_CACHE_MS) return hit;
    const entity = await this.entities.findOne({
      where: { id: legalEntityId },
      select: { id: true, offerVersion: true, billingRequired: true },
    });
    const row = { version: entity?.offerVersion ?? null, selfRegistered: !!entity?.billingRequired, at: Date.now() };
    this.cache.set(legalEntityId, row);
    return row;
  }

  forget(legalEntityId: string) {
    this.cache.delete(legalEntityId);
  }
}
