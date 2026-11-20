import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { clientIp } from '../security/utils/security.utils.js';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, EntityScope, Public, Roles } from '../common/decorators/auth.decorators.js';
import { assertInScope } from '../common/utils/entity-scope.utils.js';
import { ENTITY_NOT_FOUND } from '../legal-entities/legal-entities.constants.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';
import type {
  HrBatchSummary,
  HrBatchView,
  HrODataCheck,
  HrPushResult,
  HrSyncSettingsView,
} from '../shared/interfaces/hr-sync.interface.js';
import { ENTITY_MANAGERS, ENTITY_ROLES } from '../users/users.constants.js';
import { HR_PUSHES_PER_MINUTE } from './hr-sync.constants.js';
import { HrIssueTokenDto, HrSyncSettingsDto } from './hr-sync.dto.js';
import { HrSyncService } from './hr-sync.service.js';

/**
 * «Налаштування → Юрособа → Інтеграція з 1С». The connection (the settings, the key) — the managers of the
 * legal entity; reading, reviewing and applying the deliveries — also HR, who keeps the employees.
 */
@ApiTags('legal-entities')
@Controller('legal-entities/:id/hr-sync')
export class HrSyncController {
  constructor(
    private readonly sync: HrSyncService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles('ADMIN', ...ENTITY_ROLES)
  get(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope): Promise<HrSyncSettingsView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.sync.view(id);
  }

  @Put()
  @Roles(...ENTITY_MANAGERS)
  async save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HrSyncSettingsDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<HrSyncSettingsView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const view = await this.sync.save(id, dto, user);
    await this.audit.log('legal-entity', id, 'UPDATE', { HR_SYNC: [null, this.sync.label(view)] }, user);
    return view;
  }

  @Delete()
  @HttpCode(204)
  @Roles(...ENTITY_MANAGERS)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    await this.sync.remove(id);
    await this.audit.log('legal-entity', id, 'UPDATE', { HR_SYNC: ['підключено', null] }, user);
  }

  /** «Отримати ще раз»: a finished single load may take the data of 1C once more. */
  @Post('reopen')
  @HttpCode(200)
  @Roles(...ENTITY_MANAGERS)
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<HrSyncSettingsView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const view = await this.sync.reopen(id);
    await this.audit.log('legal-entity', id, 'UPDATE', { HR_SYNC_ONCE: ['отримано', 'отримати ще раз'] }, user);
    return view;
  }

  /** A new key for 1C — shown once; the previous one stops working. */
  @Post('token')
  @HttpCode(200)
  @Roles(...ENTITY_MANAGERS)
  async token(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HrIssueTokenDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const result = await this.sync.issueToken(id, user, dto.validDays);
    await this.audit.log('legal-entity', id, 'UPDATE', { HR_SYNC_TOKEN: [null, result.settings.tokenPrefix] }, user);
    return result;
  }

  @Delete('token')
  @Roles(...ENTITY_MANAGERS)
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<HrSyncSettingsView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const view = await this.sync.revokeToken(id);
    await this.audit.log('legal-entity', id, 'UPDATE', { HR_SYNC_TOKEN: ['видано', 'відкликано'] }, user);
    return view;
  }

  @Post('check')
  @HttpCode(200)
  @Roles(...ENTITY_MANAGERS)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  check(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope): Promise<HrODataCheck> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.sync.check(id);
  }

  /** «Отримати зараз» — reads 1C over OData. */
  @Post('pull')
  @HttpCode(200)
  @Roles('ADMIN', ...ENTITY_ROLES)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  pull(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<HrBatchView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.sync.pull(id, 'ODATA_MANUAL', user);
  }

  @Get('batches')
  @Roles('ADMIN', ...ENTITY_ROLES)
  history(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope): Promise<HrBatchSummary[]> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.sync.history(id);
  }

  @Get('batches/:batchId')
  @Roles('ADMIN', ...ENTITY_ROLES)
  async batch(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<HrBatchView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const view = await this.sync.batch(id, batchId);
    await this.audit.log('hr-sync-batch', batchId, 'VIEW', {}, user);
    return view;
  }

  @Post('batches/:batchId/apply')
  @HttpCode(200)
  @Roles('ADMIN', ...ENTITY_ROLES)
  async apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<HrBatchView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const view = await this.sync.apply(id, batchId, user);
    await this.audit.log('hr-sync-batch', batchId, 'UPDATE', { status: ['PENDING', view.status] }, user);
    return view;
  }

  @Post('batches/:batchId/discard')
  @HttpCode(200)
  @Roles('ADMIN', ...ENTITY_ROLES)
  async discard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<HrBatchView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const view = await this.sync.discard(id, batchId, user);
    await this.audit.log('hr-sync-batch', batchId, 'UPDATE', { status: ['PENDING', 'DISCARDED'] }, user);
    return view;
  }
}

/**
 * Where 1C sends the employees: no session, the key of the legal entity in «Authorization: Bearer mr1c_…».
 * A server-to-server call has no Origin / Sec-Fetch-Site — the CSRF check lets it through; the key is the check.
 */
@ApiTags('integrations')
@Controller('integrations/1c')
export class HrPushController {
  constructor(private readonly sync: HrSyncService) {}

  @Post('employees')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { limit: HR_PUSHES_PER_MINUTE, ttl: 60_000 } })
  push(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<HrPushResult> {
    return this.sync.receivePush(authorization, clientIp(req), body);
  }

  /** 1C checks the key before sending («Перевірити підключення» in the data processor). */
  @Get('ping')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async ping(@Headers('authorization') authorization: string | undefined, @Req() req: Request) {
    return this.sync.ping(authorization, clientIp(req));
  }
}
