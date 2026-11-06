import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { parseEntityId } from '../reports/utils/report-params.utils.js';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowUnassigned, CurrentUser, Roles } from '../common/decorators/auth.decorators.js';
import { entityScope, scopedEntity } from '../common/utils/entity-scope.utils.js';
import { Organization } from '../organization/organization.entity.js';
import { DailyJobService } from './daily-job.service.js';
import { NotificationsService } from './notifications.service.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly daily: DailyJobService,
    @InjectRepository(Organization) private readonly org: Repository<Organization>,
  ) {}

  /** Is e-mail configured, how many recipients, the mobilization term. */
  @AllowUnassigned()
  @Get('status')
  async status(@CurrentUser() user: AuthUser, @Query('entity') entity?: string) {
    // a director adding his first legal entity has none yet — nobody to count
    const unassigned = user.role !== 'ADMIN' && !user.legalEntityId;
    const scope: Scope = unassigned ? null : entityScope(user);
    const org = await this.org.findOneBy({ id: 1 });
    return {
      mailConfigured: this.notifications.mailConfigured,
      /** For one legal entity: the users + its extra addresses. */
      recipients: unassigned
        ? 0
        : (await this.notifications.recipients(scopedEntity(scope, parseEntityId(entity)))).length,
      mobilizationUntil: org?.mobilizationUntil ?? null,
      mobilizationDecree: org?.mobilizationDecree ?? '',
      mobilizationCheckedAt: org?.mobilizationCheckedAt ?? null,
    };
  }

  @Roles('ADMIN', 'ENTITY_ADMIN', 'DIRECTOR')
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
