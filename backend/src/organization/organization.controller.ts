import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowUnassigned, Roles } from '../common/decorators/auth.decorators.js';
import { UpdateOrganizationDto } from './organization.dto.js';
import { OrganizationService } from './organization.service.js';

/**
 * System settings (warning terms, reservation quota, mobilization term, e-mail addresses).
 * Requisites, heads and responsible persons live in the legal entities (/api/legal-entities).
 */
@ApiTags('organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @AllowUnassigned()
  @Get()
  get() {
    return this.org.get();
  }

  @Roles('ADMIN')
  @Put()
  update(@Body() dto: UpdateOrganizationDto) {
    return this.org.update(dto);
  }
}
