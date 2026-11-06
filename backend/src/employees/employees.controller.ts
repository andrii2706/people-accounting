import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, EntityScope, Roles } from '../common/decorators/auth.decorators.js';
import { scopedEntity } from '../common/utils/entity-scope.utils.js';
import {
  CreateEmployeeDto,
  DismissEmployeeDto,
  EmployeeQueryDto,
  UpdateChangeDto,
  UpdateEmployeeDto,
} from './employees.dto.js';
import { EmployeesService } from './employees.service.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  /** Everyone except the main administrator sees only the employees of his legal entity. */
  @Get()
  list(@Query() query: EmployeeQueryDto, @EntityScope() scope: Scope) {
    query.legalEntityId = scopedEntity(scope, query.legalEntityId) ?? undefined;
    return this.employees.list(query);
  }

  @Get('changes/pending')
  pending(@EntityScope() scope: Scope) {
    return this.employees.pendingChanges(scope);
  }

  @Patch('changes/:changeId')
  updateChange(
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @Body() dto: UpdateChangeDto,
    @EntityScope() scope: Scope,
  ) {
    return this.employees.updateChange(changeId, dto, scope);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    await this.employees.assertAccess(id, scope);
    return this.employees.get(id, user);
  }

  @Get(':id/audit')
  async audit(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope) {
    await this.employees.assertAccess(id, scope);
    return this.employees.auditTrail(id);
  }

  /** A new employee joins the user's legal entity (the main administrator chooses it). */
  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    dto.legalEntityId = scopedEntity(scope, dto.legalEntityId) ?? undefined;
    return this.employees.create(dto, user);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    await this.employees.assertAccess(id, scope);
    // moving to another legal entity — only the main administrator
    if (dto.legalEntityId !== undefined) scopedEntity(scope, dto.legalEntityId);
    return this.employees.update(id, dto, user);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DismissEmployeeDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    await this.employees.assertAccess(id, scope);
    return this.employees.dismiss(id, dto, user);
  }

  @Roles('ADMIN', 'ENTITY_ADMIN', 'DIRECTOR')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    await this.employees.assertAccess(id, scope);
    return this.employees.remove(id, user);
  }
}
