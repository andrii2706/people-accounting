import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Roles } from '../common/decorators/auth.decorators.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import {
  ChangePersonDto,
  CreateLegalEntityDto,
  GrantAccessDto,
  RegistryLookupDto,
  UpdateLegalEntityDto,
} from './legal-entities.dto.js';
import { LegalEntityAccessService } from './legal-entity-access.service.js';
import { parsePerson } from './utils/person.utils.js';
import { LegalEntitiesService } from './legal-entities.service.js';

@ApiTags('legal-entities')
@Controller('legal-entities')
export class LegalEntitiesController {
  constructor(
    private readonly entities: LegalEntitiesService,
    private readonly access: LegalEntityAccessService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.entities.list();
  }

  /** ЄДР data by the company code (free service) — fills the form, nothing is saved. */
  @Roles('ADMIN')
  @Get('lookup')
  lookup(@Query() query: RegistryLookupDto) {
    return this.entities.lookup(query.edrpou);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.entities.get(id);
  }

  /** Accounts of the head and of the responsible person. */
  @Roles('ADMIN')
  @Get(':id/people')
  people(@Param('id', ParseUUIDPipe) id: string) {
    return this.access.people(id);
  }

  /** Gives the head / the responsible person access: login = e-mail, temporary password shown once. */
  @Roles('ADMIN')
  @Post(':id/people/:person/access')
  async grant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('person') person: string,
    @Body() dto: GrantAccessDto,
    @CurrentUser() user: AuthUser,
  ) {
    const who = parsePerson(person);
    const result = await this.access.grant(id, who, dto, user);
    await this.audit.log('legal-entity', id, 'UPDATE', { [`${who}_ACCESS`]: [null, result.access.email] }, user);
    return result;
  }

  /** Turns the access of the head / the responsible person off. */
  @Roles('ADMIN')
  @Delete(':id/people/:person/access')
  async revoke(@Param('id', ParseUUIDPipe) id: string, @Param('person') person: string, @CurrentUser() user: AuthUser) {
    const who = parsePerson(person);
    const result = await this.access.revoke(id, who, user);
    await this.audit.log('legal-entity', id, 'UPDATE', { [`${who}_ACCESS`]: [result.email, null] }, user);
    return result;
  }

  /** A new head / responsible person (replaces the current details), optionally with access. */
  @Roles('ADMIN')
  @Put(':id/people/:person')
  async change(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('person') person: string,
    @Body() dto: ChangePersonDto,
    @CurrentUser() user: AuthUser,
  ) {
    const who = parsePerson(person);
    const before = await this.entities.get(id);
    const result = await this.access.change(id, who, dto, user);
    const nameField = who === 'HEAD' ? 'headName' : 'responsibleName';
    await this.audit.log('legal-entity', id, 'UPDATE', { [nameField]: [before[nameField], dto.fullName] }, user);
    return result;
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateLegalEntityDto, @CurrentUser() user: AuthUser) {
    const entity = await this.entities.create(dto);
    await this.audit.log('legal-entity', entity.id, 'CREATE', { edrpou: [null, entity.edrpou] }, user);
    return entity;
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalEntityDto,
    @CurrentUser() user: AuthUser,
  ) {
    const entity = await this.entities.update(id, dto);
    await this.audit.log(
      'legal-entity',
      id,
      'UPDATE',
      Object.fromEntries(Object.entries(dto).map(([k, v]) => [k, [null, v]])),
      user,
    );
    return entity;
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.entities.remove(id);
    await this.audit.log('legal-entity', id, 'DELETE', {}, user);
  }
}
