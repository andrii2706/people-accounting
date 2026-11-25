import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, EntityScope, Roles } from '../common/decorators/auth.decorators.js';
import { scopedEntity } from '../common/utils/entity-scope.utils.js';
import {
  AssignTckDto,
  CreateEmployeeDto,
  DismissEmployeeDto,
  EmployeeQueryDto,
  UpdateChangeDto,
  UpdateEmployeeDto,
} from './employees.dto.js';
import { EmployeesService } from './employees.service.js';
import { dismissedXlsx } from './utils/dismissed-export.utils.js';
import { attachmentFile } from '../common/utils/file-response.utils.js';
import { XLSX_MIME } from '../common/constants/mime.constants.js';
import { formatUa } from '../common/utils/dates.utils.js';
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

  /** «Звільнені» as an .xlsx (the dismissal, the order, the notice to the TCK) — of the scope. */
  @Get('dismissed.xlsx')
  async dismissedXlsx(@Query() query: EmployeeQueryDto, @EntityScope() scope: Scope) {
    const legalEntityId = scopedEntity(scope, query.legalEntityId) ?? undefined;
    const list = await this.employees.list({ ...query, legalEntityId, status: 'dismissed' });
    const buffer = await dismissedXlsx(
      list.items.map((e) => ({
        fullName: `${e.lastName} ${e.firstName} ${e.middleName}`.trim(),
        personnelNumber: e.personnelNumber,
        position: e.position,
        dismissalDate: e.dismissalDate,
        order: [
          e.dismissalOrderNumber && `№ ${e.dismissalOrderNumber}`,
          e.dismissalOrderDate && `від ${formatUa(e.dismissalOrderDate)}`,
        ]
          .filter(Boolean)
          .join(' '),
        notice: e.dismissalNotice,
        legalEntityName: e.legalEntityName,
      })),
    );
    return attachmentFile(buffer, `Звільнені ${formatUa(list.date)}.xlsx`, XLSX_MIME);
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

  /** Employees without a TCK whose military document was issued by this TCK. */
  @Get('tck-matches/:tckId')
  tckMatches(@Param('tckId', ParseUUIDPipe) tckId: string, @EntityScope() scope: Scope) {
    return this.employees.tckMatches(tckId, scope);
  }

  @Post('tck-assign')
  @HttpCode(200)
  assignTck(@Body() dto: AssignTckDto, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    return this.employees.assignTck(dto.tckId, dto.employeeIds, user, scope);
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
