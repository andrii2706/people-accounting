import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { todayIso } from '../common/utils/dates.utils.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { SubscriptionGate } from '../shared/interfaces/subscription.interface.js';
import { Subscription } from './subscription.entity.js';
import { GATE_CACHE_MS } from './subscriptions.constants.js';
import { gateOf, subscriptionState } from './utils/subscription.utils.js';

/**
 * Asked by the AuthGuard on every request of a legal entity: may it work (a plan chosen, paid or in trial).
 * The answer is kept for a minute per instance; a change on this instance forgets it at once.
 */
@Injectable()
export class SubscriptionGateService {
  private readonly cache = new Map<string, { gate: SubscriptionGate; at: number }>();

  constructor(
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
  ) {}

  async gate(legalEntityId: string): Promise<SubscriptionGate> {
    const hit = this.cache.get(legalEntityId);
    if (hit && Date.now() - hit.at < GATE_CACHE_MS) return hit.gate;
    const entity = await this.entities.findOne({
      where: { id: legalEntityId },
      select: { id: true, billingRequired: true },
    });
    let gate: SubscriptionGate = 'OK';
    if (entity?.billingRequired) {
      const sub = await this.subscriptions.findOneBy({ legalEntityId });
      gate = gateOf(subscriptionState(sub, todayIso()));
    }
    this.cache.set(legalEntityId, { gate, at: Date.now() });
    return gate;
  }

  forget(legalEntityId: string | null) {
    if (legalEntityId) this.cache.delete(legalEntityId);
  }
}
