import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/auth.js';
import {
  CreateOrganizationHeadDto,
  CreateResponsiblePersonDto,
  UpdateOrganizationDto,
  UpdateOrganizationHeadDto,
  UpdateResponsiblePersonDto,
} from './organization.dto.js';
import { OrganizationService } from './organization.service.js';

@ApiTags('organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @Get()
  get() {
    return this.org.get();
  }

  @Roles('ADMIN')
  @Put()
  update(@Body() dto: UpdateOrganizationDto) {
    return this.org.update(dto);
  }

  @Get('responsible-persons')
  listResponsible() {
    return this.org.listResponsible();
  }

  @Roles('ADMIN')
  @Post('responsible-persons')
  createResponsible(@Body() dto: CreateResponsiblePersonDto) {
    return this.org.createResponsible(dto);
  }

  @Roles('ADMIN')
  @Patch('responsible-persons/:id')
  updateResponsible(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResponsiblePersonDto) {
    return this.org.updateResponsible(id, dto);
  }

  @Roles('ADMIN')
  @Delete('responsible-persons/:id')
  removeResponsible(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.removeResponsible(id);
  }

  // ---------------------------------------------------------------- heads (directors) by period

  @Get('heads')
  listHeads() {
    return this.org.listHeads();
  }

  @Roles('ADMIN')
  @Post('heads')
  createHead(@Body() dto: CreateOrganizationHeadDto) {
    return this.org.createHead(dto);
  }

  @Roles('ADMIN')
  @Patch('heads/:id')
  updateHead(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationHeadDto) {
    return this.org.updateHead(id, dto);
  }

  @Roles('ADMIN')
  @Delete('heads/:id')
  removeHead(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.removeHead(id);
  }
}
