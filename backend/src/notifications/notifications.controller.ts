import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { Organization } from '../organization/organization.entity.js';
import { DailyJobService } from './daily-job.service.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly daily: DailyJobService,
    @InjectRepository(Organization) private readonly org: Repository<Organization>,
  ) {}

  /** Is e-mail configured, how many recipients, the mobilization term. */
  @Get('status')
  async status() {
    const org = await this.org.findOneBy({ id: 1 });
    return {
      mailConfigured: this.notifications.mailConfigured,
      recipients: (await this.notifications.recipients()).length,
      mobilizationUntil: org?.mobilizationUntil ?? null,
      mobilizationDecree: org?.mobilizationDecree ?? '',
      mobilizationCheckedAt: org?.mobilizationCheckedAt ?? null,
    };
  }

  @Roles('ADMIN')
  @Post('test')
  @HttpCode(200)
  async test(@CurrentUser() user: AuthUser) {
    const sent = await this.notifications.test(user.email);
    return { sent };
  }

  /** Checks the presidential decrees right now (normally done by the daily job). */
  @Roles('ADMIN')
  @Post('check-decrees')
  @HttpCode(200)
  checkDecrees() {
    return this.daily.updateMobilization();
  }

  @Roles('ADMIN')
  @Post('run-daily')
  @HttpCode(200)
  runDaily() {
    return this.daily.run();
  }
}
