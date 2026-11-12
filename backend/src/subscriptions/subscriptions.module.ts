import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { User } from '../users/user.entity.js';
import { BillingSettings } from './billing-settings.entity.js';
import { Invoice } from './invoice.entity.js';
import { OfferGateService } from './offer-gate.service.js';
import { OfferSignature } from './offer-signature.entity.js';
import { OfferService } from './offer.service.js';
import { Subscription } from './subscription.entity.js';
import { SubscriptionGateService } from './subscription-gate.service.js';
import { SubscriptionsController, TermsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { VendorBillingController } from './vendor-billing.controller.js';

/** Global: the AuthGuard asks the gate on every request. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Invoice, BillingSettings, LegalEntity, User, OfferSignature]),
    LegalEntitiesModule,
  ],
  providers: [SubscriptionsService, SubscriptionGateService, OfferGateService, OfferService],
  controllers: [TermsController, SubscriptionsController, VendorBillingController],
  exports: [SubscriptionGateService, SubscriptionsService, OfferGateService],
})
export class SubscriptionsModule {}
