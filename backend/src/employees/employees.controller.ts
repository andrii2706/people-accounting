import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../common/auth.js';
import {
  CreateEmployeeDto,
  DismissEmployeeDto,
  EmployeeQueryDto,
  UpdateChangeDto,
  UpdateEmployeeDto,
} from './employees.dto.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query() query: EmployeeQueryDto) {
    return this.employees.list(query);
  }

  /** Changes awaiting a notice to the TCK (for all employees). */
  @Get('changes/pending')
  pending() {
    return this.employees.pendingChanges();
  }

  @Patch('changes/:changeId')
  updateChange(@Param('changeId', ParseUUIDPipe) changeId: string, @Body() dto: UpdateChangeDto) {
    return this.employees.updateChange(changeId, dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.employees.get(id, user);
  }

  @Get(':id/audit')
  audit(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.auditTrail(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.update(id, dto, user);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  dismiss(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DismissEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.dismiss(id, dto, user);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.employees.remove(id, user);
  }
}
