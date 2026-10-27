import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    const user = await this.users.create(dto);
    await this.audit.log('user', user.id, 'CREATE', { email: [null, user.email], role: [null, user.role] }, actor);
    return user;
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    const user = await this.users.update(id, dto, actor.id);
    await this.audit.log('user', id, 'USER_UPDATED', Object.fromEntries(Object.entries(dto).map(([k, v]) => [k, [null, v]])), actor);
    return user;
  }

  /** The temporary password is returned once — hand it to the user over a secure channel. */
  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    const result = await this.users.resetPassword(id);
    await this.audit.log('user', id, 'PASSWORD_RESET', {}, actor);
    return result;
  }

  @Post(':id/unlock')
  @HttpCode(200)
  async unlock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    const user = await this.users.unlock(id);
    await this.audit.log('user', id, 'USER_UPDATED', { lockedUntil: ['…', null] }, actor);
    return user;
  }
}
