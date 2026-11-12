import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { UsersModule } from '../users/users.module.js';
import { SignupRequest } from './signup-request.entity.js';
import { SignupController } from './signup.controller.js';
import { SignupService } from './signup.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SignupRequest, LegalEntity]),
    LegalEntitiesModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [SignupController],
  providers: [SignupService],
  exports: [SignupService],
})
export class SignupModule {}
