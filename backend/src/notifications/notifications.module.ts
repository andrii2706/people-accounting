import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { QuotaRecalculation } from '../legal-entities/quota-recalculation.entity.js';
import { Organization } from '../organization/organization.entity.js';
import { User } from '../users/user.entity.js';
import { UsersModule } from '../users/users.module.js';
import { DailyJobService } from './daily-job.service.js';
import { MailService } from './mail.service.js';
import { NotificationLog } from './notification-log.entity.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { QuotaWatchService } from './quota-watch.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, NotificationLog, Employee, LegalEntity, QuotaRecalculation]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [MailService, NotificationsService, DailyJobService, QuotaWatchService],
  exports: [NotificationsService, DailyJobService, QuotaWatchService],
})
export class NotificationsModule {}
