import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { AllowUnassigned, CurrentUser, EntityScope, Roles } from '../common/decorators/auth.decorators.js';
import { assertInScope, entityScope } from '../common/utils/entity-scope.utils.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';
import {
  ChangePersonDto,
  CreateLegalEntityDto,
  GrantAccessDto,
  RegistryLookupDto,
  UpdateLegalEntityDto,
} from './legal-entities.dto.js';
import { LegalEntityAccessService } from './legal-entity-access.service.js';
import { parsePerson } from './utils/person.utils.js';
import { changedFields, entityHistory } from './utils/entity-history.utils.js';
import { ENTITY_FORM_FIELDS, ENTITY_NOT_FOUND, PERSON_FIELDS } from './legal-entities.constants.js';
import type { LegalEntity } from './legal-entity.entity.js';
import type { AccessRole } from '../shared/interfaces/legal-entity.interface.js';
import { ENTITY_MANAGERS } from '../users/users.constants.js';
import { LegalEntitiesService } from './legal-entities.service.js';

@ApiTags('legal-entities')
@Controller('legal-entities')
export class LegalEntitiesController {
  constructor(
    private readonly entities: LegalEntitiesService,
    private readonly access: LegalEntityAccessService,
    private readonly audit: AuditService,
  ) {}

  /** The user's legal entity (the main administrator — all of them; an account without one — none). */
  @AllowUnassigned()
  @Get()
  list(@CurrentUser() user: AuthUser) {
    if (user.role !== 'ADMIN' && !user.legalEntityId) return [];
    return this.entities.list(undefined, entityScope(user));
  }

  /** ЄДР data by the company code (free service) — fills the form, nothing is saved. */
  @Roles('ADMIN', 'DIRECTOR')
  @AllowUnassigned()
  @Get('lookup')
  lookup(@Query() query: RegistryLookupDto) {
    return this.entities.lookup(query.edrpou);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.entities.get(id);
  }

  /** Accounts of the head and of the responsible person. */
  @Roles(...ENTITY_MANAGERS)
  @Get(':id/people')
  people(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.access.people(id);
  }

  /** Gives the head / the responsible person access: login = e-mail, temporary password shown once. */
  @Roles(...ENTITY_MANAGERS)
  @Post(':id/people/:person/access')
  async grant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('person') person: string,
    @Body() dto: GrantAccessDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    this.assertAccessRole(user, dto.role);
    const who = parsePerson(person);
    const result = await this.access.grant(id, who, dto, user);
    await this.audit.log('legal-entity', id, 'UPDATE', { [`${who}_ACCESS`]: [null, result.access.email] }, user);
    return result;
  }

  /** Turns the access of the head / the responsible person off. */
  @Roles(...ENTITY_MANAGERS)
  @Delete(':id/people/:person/access')
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('person') person: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const who = parsePerson(person);
    const result = await this.access.revoke(id, who, user);
    await this.audit.log('legal-entity', id, 'UPDATE', { [`${who}_ACCESS`]: [result.email, null] }, user);
    return result;
  }

  /** A new head / responsible person (replaces the current details), optionally with access. */
  @Roles(...ENTITY_MANAGERS)
  @Put(':id/people/:person')
  async change(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('person') person: string,
    @Body() dto: ChangePersonDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    if (dto.email) this.assertAccessRole(user, dto.role);
    const who = parsePerson(person);
    const [before, people] = await Promise.all([this.entities.get(id), this.access.people(id)]);
    const result = await this.access.change(id, who, dto, user);
    const after = await this.entities.get(id);

    // the journal: the new name / position / phone, whose login now opens the system, what happened to the old one
    const f = PERSON_FIELDS[who];
    const fields = [f.name, f.position, ...(f.phone ? [f.phone] : [])];
    const diff = changedFields(before, after, fields);
    const previous = people[who]?.email ?? null;
    const next = result.granted?.access.email ?? null;
    if (previous !== next) diff[`${who}_ACCESS`] = [previous, next];
    if (previous) {
      diff[`${who}_PREVIOUS_ACCESS`] = [
        previous,
        result.revoked ? 'скасовано' : 'залишився (лише відв’язано від юрособи)',
      ];
    }
    if (Object.keys(diff).length) await this.audit.log('legal-entity', id, 'UPDATE', diff, user);
    return result;
  }

  /** Journal: who changed the requisites, the head, the responsible person, the access, and when. */
  @Roles(...ENTITY_MANAGERS)
  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    await this.entities.get(id);
    return entityHistory(await this.audit.trail('legal-entity', id));
  }

  /**
   * A new legal entity. The director adds only his own one — once, while his account has none; from then on he
   * belongs to it and is its head. The main administrator may add any.
   */
  @Roles('ADMIN', 'DIRECTOR')
  @AllowUnassigned()
  @Post()
  async create(@Body() dto: CreateLegalEntityDto, @CurrentUser() user: AuthUser) {
    if (user.role === 'DIRECTOR' && user.legalEntityId) {
      throw new ForbiddenException('Ваша юридична особа вже додана — директор додає лише свою');
    }
    const entity = await this.entities.create(dto);
    if (user.role === 'DIRECTOR') await this.access.adoptByDirector(entity.id, user);
    const empty = Object.fromEntries(ENTITY_FORM_FIELDS.map((k) => [k, null])) as unknown as LegalEntity;
    await this.audit.log('legal-entity', entity.id, 'CREATE', changedFields(empty, entity, ENTITY_FORM_FIELDS), user);
    return entity;
  }

  @Roles(...ENTITY_MANAGERS)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalEntityDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    // a separate copy: update() loads and changes its own instance
    const before = await this.entities.get(id);
    const entity = await this.entities.update(id, dto);
    const diff = changedFields(before, entity, ENTITY_FORM_FIELDS);
    if (Object.keys(diff).length) await this.audit.log('legal-entity', id, 'UPDATE', diff, user);
    return entity;
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.entities.remove(id);
    await this.audit.log('legal-entity', id, 'DELETE', {}, user);
  }

  /** The entity administrator role is given only by the main administrator. */
  private assertAccessRole(actor: AuthUser, role: AccessRole | undefined) {
    if (role === 'ENTITY_ADMIN' && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Адміністратора юрособи призначає головний адміністратор');
    }
  }
}
