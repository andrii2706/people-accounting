import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { BillingStatusEntity } from './billing-status.entity.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([BillingStatusEntity, User])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
