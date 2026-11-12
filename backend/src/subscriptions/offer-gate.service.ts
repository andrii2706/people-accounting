import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { KepVerifierService } from '../kep/kep-verifier.service.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { GATE_CACHE_MS } from './subscriptions.constants.js';
import { TERMS_EXEMPT_ROLES, TERMS_VERSION } from './terms.constants.js';

/**
 * Has the legal entity of the user accepted the current offer (signed by the head with KEP)?
 * Asked by the AuthGuard on every request; kept for a minute per instance, forgotten at once on signing.
 * Until a KEP check is configured the offer is not required — so a new version can be deployed safely.
 */
@Injectable()
export class OfferGateService {
  private readonly cache = new Map<string, { version: string | null; at: number }>();

  constructor(
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly kep: KepVerifierService,
  ) {}

  /** The offer is required for this user (works in a legal entity, KEP check configured). */
  required(user: Pick<AuthUser, 'role' | 'legalEntityId'>): boolean {
    return this.kep.available && !!user.legalEntityId && !TERMS_EXEMPT_ROLES.includes(user.role);
  }

  async accepted(user: Pick<AuthUser, 'role' | 'legalEntityId'>): Promise<boolean> {
    if (!this.required(user)) return true;
    return (await this.version(user.legalEntityId!)) === TERMS_VERSION;
  }

  private async version(legalEntityId: string): Promise<string | null> {
    const hit = this.cache.get(legalEntityId);
    if (hit && Date.now() - hit.at < GATE_CACHE_MS) return hit.version;
    const entity = await this.entities.findOne({
      where: { id: legalEntityId },
      select: { id: true, offerVersion: true },
    });
    const version = entity?.offerVersion ?? null;
    this.cache.set(legalEntityId, { version, at: Date.now() });
    return version;
  }

  forget(legalEntityId: string) {
    this.cache.delete(legalEntityId);
  }
}
