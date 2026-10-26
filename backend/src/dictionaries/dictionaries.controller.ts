import { Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags, PartialType } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Repository } from 'typeorm';
import { AllowPendingPasswordChange, Roles } from '../common/auth.js';
import {
  CHANGE_TYPE_LABELS,
  DUTY_CATEGORY_LABELS,
  EDUCATION_LEVELS,
  FAMILY_RELATION_LABELS,
  FITNESS_STATUSES,
  LIST_GROUP_TITLES,
  MARITAL_STATUSES,
  MILITARY_DOCUMENT_TYPES,
} from '../military/dictionaries.js';
import { COMPOSITION_LABELS, RANKS } from '../military/ranks.js';
import { Tck } from './tck.entity.js';

class CreateTckDto {
  @IsString() @IsNotEmpty({ message: 'Вкажіть назву' }) @MaxLength(300, { message: 'Не більше 300 символів' }) name: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'Не більше 300 символів' }) nameGenitive?: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'Не більше 300 символів' }) address?: string;
  @IsOptional() @IsString() @MaxLength(200, { message: 'Не більше 200 символів' }) phone?: string;
  @IsOptional() @ValidateIf((o: CreateTckDto) => !!o.email) @IsEmail({}, { message: 'Некоректний email' }) @MaxLength(200) email?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateTckDto extends PartialType(CreateTckDto) {}

@ApiTags('dictionaries')
@Controller()
export class DictionariesController {
  constructor(@InjectRepository(Tck) private readonly tckRepo: Repository<Tck>) {}

  /**
   * Усі статичні довідники одним запитом — фронтенд кешує їх у сигналі.
   * Довідкові дані без персональних — доступні й до зміни тимчасового пароля (потрібні каркасу застосунку).
   */
  @AllowPendingPasswordChange()
  @Get('dictionaries')
  all() {
    return {
      ranks: RANKS.map((r) => ({ ...r, compositionLabel: COMPOSITION_LABELS[r.composition] })),
      educationLevels: EDUCATION_LEVELS,
      maritalStatuses: MARITAL_STATUSES,
      militaryDocumentTypes: MILITARY_DOCUMENT_TYPES,
      fitnessStatuses: FITNESS_STATUSES,
      familyRelations: Object.entries(FAMILY_RELATION_LABELS).map(([value, label]) => ({ value, label })),
      changeTypes: Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      listGroups: Object.entries(LIST_GROUP_TITLES).map(([value, label]) => ({ value, label })),
      dutyCategories: Object.entries(DUTY_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  @AllowPendingPasswordChange()
  @Get('tck')
  listTck() {
    return this.tckRepo.find({ order: { name: 'ASC' } });
  }

  @Roles('ADMIN')
  @Post('tck')
  createTck(@Body() dto: CreateTckDto) {
    return this.tckRepo.save(this.tckRepo.create(dto));
  }

  @Roles('ADMIN')
  @Patch('tck/:id')
  async updateTck(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTckDto) {
    const tck = await this.tckRepo.findOneBy({ id });
    if (!tck) throw new NotFoundException();
    Object.assign(tck, dto);
    return this.tckRepo.save(tck);
  }

  @Roles('ADMIN')
  @Delete('tck/:id')
  async removeTck(@Param('id', ParseUUIDPipe) id: string) {
    await this.tckRepo.update(id, { isActive: false });
  }
}
