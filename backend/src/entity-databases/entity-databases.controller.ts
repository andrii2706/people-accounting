import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, EntityScope, Roles } from '../common/decorators/auth.decorators.js';
import { assertInScope } from '../common/utils/entity-scope.utils.js';
import { ENTITY_NOT_FOUND } from '../legal-entities/legal-entities.constants.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';
import type { DatabaseCheckResult, EntityDatabaseView } from '../shared/interfaces/entity-database.interface.js';
import { ENTITY_MANAGERS } from '../users/users.constants.js';
import { EntityDatabaseDto } from './entity-databases.dto.js';
import { EntityDatabasesService } from './entity-databases.service.js';

/** The own database of a legal entity — its administrator, director, or the main administrator. */
@ApiTags('legal-entities')
@Roles(...ENTITY_MANAGERS)
@Controller('legal-entities/:id/database')
export class EntityDatabasesController {
  constructor(
    private readonly databases: EntityDatabasesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  get(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope): Promise<EntityDatabaseView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.databases.get(id);
  }

  @Put()
  async save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EntityDatabaseDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<EntityDatabaseView> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const view = await this.databases.save(id, dto, user);
    await this.audit.log(
      'legal-entity',
      id,
      'UPDATE',
      { DATABASE: [null, `${dto.username}@${dto.host}:${dto.port}/${dto.database} (${dto.sslMode})`] },
      user,
    );
    return view;
  }

  @Post('check')
  @HttpCode(200)
  async check(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<DatabaseCheckResult> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const result = await this.databases.check(id);
    await this.audit.log(
      'legal-entity',
      id,
      'VIEW',
      { DATABASE_CHECK: [null, result.ok ? 'OK' : result.message] },
      user,
    );
    return result;
  }

  @Delete()
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    await this.databases.remove(id);
    await this.audit.log('legal-entity', id, 'UPDATE', { DATABASE: ['підключено', null] }, user);
  }
}
