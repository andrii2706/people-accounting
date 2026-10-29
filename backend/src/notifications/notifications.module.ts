import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity.js';
import { Organization } from '../organization/organization.entity.js';
import { User } from '../users/user.entity.js';
import { DailyJobService } from './daily-job.service.js';
import { MailService } from './mail.service.js';
import { NotificationLog } from './notification-log.entity.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, Organization, NotificationLog, Employee])],
  controllers: [NotificationsController],
  providers: [MailService, NotificationsService, DailyJobService],
  exports: [NotificationsService, DailyJobService],
})
export class NotificationsModule {}
