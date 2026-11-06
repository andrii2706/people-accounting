import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowPendingPasswordChange, AllowUnassigned, Roles } from '../common/decorators/auth.decorators.js';
import {
  CHANGE_TYPE_LABELS,
  DUTY_CATEGORY_LABELS,
  EDUCATION_LEVELS,
  FAMILY_RELATION_LABELS,
  FITNESS_STATUSES,
  LIST_GROUP_TITLES,
  LIST_SECTION_TITLES,
  MARITAL_STATUSES,
  MILITARY_DOCUMENT_TYPES,
} from '../military/dictionaries.js';
import { COMPOSITION_LABELS, RANKS } from '../military/ranks.js';
import { Tck } from './tck.entity.js';
import { CreateTckDto } from './dictionaries.dto.js';
import { ImportTckDto } from './dictionaries.dto.js';
import { UpdateTckDto } from './dictionaries.dto.js';

@ApiTags('dictionaries')
@Controller()
export class DictionariesController {
  constructor(@InjectRepository(Tck) private readonly tckRepo: Repository<Tck>) {}

  /**
   * All static dictionaries in one request — the frontend caches them in a signal.
   * Reference data without personal data — available even before the temporary password is changed (needed by the app shell).
   */
  @AllowPendingPasswordChange()
  @AllowUnassigned()
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
      listSections: Object.entries(LIST_SECTION_TITLES).map(([value, label]) => ({ value, label })),
      dutyCategories: Object.entries(DUTY_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  @AllowPendingPasswordChange()
  @AllowUnassigned()
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
  /**
   * Bulk import of the TCK directory: matched by name — existing ones are updated, new ones created.
   * Nothing is deleted. Employees keep their links to TCKs.
   */
  @Roles('ADMIN')
  @Post('tck/import')
  @HttpCode(200)
  async importTck(@Body() dto: ImportTckDto) {
    const existing = await this.tckRepo.find();
    const byName = new Map(existing.map((t) => [t.name.trim().toLowerCase(), t]));
    let created = 0;
    let updated = 0;
    await this.tckRepo.manager.transaction(async (m) => {
      for (const item of dto.items) {
        const key = item.name.trim().toLowerCase();
        const found = byName.get(key);
        if (found) {
          Object.assign(found, { ...item, name: found.name });
          await m.save(found);
          updated++;
        } else {
          const saved = await m.save(m.create(Tck, { ...item, name: item.name.trim() }));
          byName.set(key, saved);
          created++;
        }
      }
    });
    return { created, updated };
  }

  /**
   * The TCK directory is shared by all legal entities — a changed e-mail would redirect the notices of every
   * one of them, so only the main administrator edits it.
   */
  @Roles('ADMIN')
  @Patch('tck/:id')
  async updateTck(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTckDto) {
    const tck = await this.tckRepo.findOneBy({ id });
    if (!tck) throw new NotFoundException('ТЦК не знайдено в довіднику');
    Object.assign(tck, dto);
    return this.tckRepo.save(tck);
  }

  @Roles('ADMIN')
  @Delete('tck/:id')
  async removeTck(@Param('id', ParseUUIDPipe) id: string) {
    await this.tckRepo.update(id, { isActive: false });
  }
}
