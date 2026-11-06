import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, EntityScope, Roles } from '../common/decorators/auth.decorators.js';
import { assertInScope } from '../common/utils/entity-scope.utils.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';
import { canManage, issuableRoles } from './utils/user-policy.utils.js';
import type { AuthUser, Scope, UserRole } from '../shared/interfaces/auth.interface.js';

/**
 * Accounts. The main administrator — all of them; the administrator / director of a legal entity —
 * the HR and director accounts of his legal entity (the entity administrator is appointed by the main one).
 */
@ApiTags('users')
@Roles('ADMIN', 'ENTITY_ADMIN', 'DIRECTOR')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@EntityScope() scope: Scope) {
    return this.users.list(scope);
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @EntityScope() scope: Scope) {
    this.assertRole(actor, dto.role ?? 'HR');
    dto.legalEntityId = scope ?? dto.legalEntityId ?? null;
    const user = await this.users.create(dto, { issuedBy: actor });
    await this.audit.log(
      'user',
      user.id,
      'CREATE',
      { email: [null, user.email], role: [null, user.role], legalEntityId: [null, user.legalEntityId] },
      actor,
    );
    return user;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    await this.manageable(id, actor);
    if (dto.role) this.assertRole(actor, dto.role);
    // another legal entity — only the main administrator
    if (dto.legalEntityId !== undefined) assertInScope(scope, dto.legalEntityId, 'Юридичну особу не знайдено');
    const user = await this.users.update(id, dto, actor.id);
    await this.audit.log(
      'user',
      id,
      'USER_UPDATED',
      Object.fromEntries(Object.entries(dto).map(([k, v]) => [k, [null, v]])),
      actor,
    );
    return user;
  }

  /** The temporary password is returned once — hand it to the user over a secure channel. */
  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    await this.manageable(id, actor);
    const result = await this.users.resetPassword(id, actor);
    await this.audit.log('user', id, 'PASSWORD_RESET', {}, actor);
    return result;
  }

  /** Letter «change your password» with a link; until it is changed the user gets only the password page. */
  @Post(':id/password-change-request')
  @HttpCode(200)
  async requestPasswordChange(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    await this.manageable(id, actor);
    const result = await this.users.requestPasswordChange(id, actor);
    await this.audit.log('user', id, 'USER_UPDATED', { passwordChangeRequested: [null, true] }, actor);
    return result;
  }

  @Post(':id/unlock')
  @HttpCode(200)
  async unlock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    await this.manageable(id, actor);
    const user = await this.users.unlock(id);
    await this.audit.log('user', id, 'USER_UPDATED', { lockedUntil: ['…', null] }, actor);
    return user;
  }

  /** An account of another legal entity is «not found»; a higher one of his own — «not allowed». */
  private async manageable(id: string, actor: AuthUser) {
    const target = await this.users.findById(id);
    if (canManage(actor, target)) return target;
    if (actor.role !== 'ADMIN' && target.legalEntityId !== actor.legalEntityId) {
      throw new NotFoundException('Користувача не знайдено');
    }
    throw new ForbiddenException('Цим обліковим записом керує головний адміністратор');
  }

  private assertRole(actor: AuthUser, role: UserRole) {
    if (!issuableRoles(actor).includes(role)) {
      throw new ForbiddenException('Цю роль призначає головний адміністратор');
    }
  }
}
