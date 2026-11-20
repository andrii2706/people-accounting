import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../audit/audit.service.js';
import { CurrentUser, EntityScope, Roles } from '../../common/decorators/auth.decorators.js';
import { assertInScope, scopedEntity } from '../../common/utils/entity-scope.utils.js';
import { docxFile, listsFile } from '../../common/utils/file-response.utils.js';
import type { AuthUser, Scope } from '../../shared/interfaces/auth.interface.js';
import type { ListSection } from '../../shared/interfaces/dictionary.interface.js';
import type {
  ListSectionSettings,
  ListSettings,
  ListSettingsPage,
  UploadedTemplate,
} from '../../shared/interfaces/list-settings.interface.js';
import { parseEntityId, parseListSection } from '../utils/report-params.utils.js';
import { ListSettingsService } from './list-settings.service.js';
import { ListSnapshotsService } from './list-snapshots.service.js';
import { LIST_FILE_NAMES, LIST_ROLES, MAX_TEMPLATE_BYTES } from './lists.constants.js';
import { CreateListSnapshotDto, ListSectionSettingsDto } from './lists.dto.js';
import { UploadGuardService } from '../../security/upload-guard.service.js';

const ENTITY_NOT_FOUND = 'Юридичну особу не знайдено';

function requiredSection(value: string): ListSection {
  const section = parseListSection(value);
  if (!section) throw new BadRequestException('Невідомий список');
  return section;
}

/** Changed fields of one list's settings, for the journal. */
function settingsDiff(before: ListSectionSettings, after: ListSectionSettings) {
  const diff: Record<string, [unknown, unknown]> = {};
  for (const key of ['columns', 'sort', 'groupBy', 'title', 'subtitle', 'showOutgoing', 'signers'] as const) {
    const a = JSON.stringify(before[key]);
    const b = JSON.stringify(after[key]);
    if (a !== b) diff[key] = [before[key], after[key]];
  }
  return diff;
}

/** Formed lists (snapshots) and how the lists of a legal entity look. */
@ApiTags('reports')
@Controller()
export class ListsController {
  constructor(
    private readonly snapshots: ListSnapshotsService,
    private readonly settings: ListSettingsService,
    private readonly audit: AuditService,
    private readonly uploads: UploadGuardService,
  ) {}

  @ApiQuery({ name: 'entity', required: false })
  @Get('reports/lists/snapshots')
  history(@EntityScope() scope: Scope, @Query('entity') entity?: string) {
    return this.snapshots.list(scopedEntity(scope, parseEntityId(entity)));
  }

  @Roles(...LIST_ROLES)
  @Post('reports/lists/snapshots')
  form(@Body() dto: CreateListSnapshotDto, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    return this.snapshots.create(dto.date, scopedEntity(scope, dto.legalEntityId ?? null), user);
  }

  @Get('reports/lists/snapshots/:id')
  snapshot(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope) {
    return this.snapshots.get(id, scope);
  }

  @ApiQuery({
    name: 'section',
    required: false,
    description: 'OFFICERS | SOLDIERS | WOMEN | CONSCRIPTS; без нього — усі',
  })
  @Get('reports/lists/snapshots/:id/docx')
  async snapshotDocx(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
    @Query('section') section?: string,
  ) {
    const list = parseListSection(section);
    const doc = await this.snapshots.document(id, scope, list, user);
    const name = list ? `Списки — ${LIST_FILE_NAMES[list].replace(/^\d /, '')}` : 'Списки військового обліку';
    return listsFile(doc, `${name} ${doc.date}`);
  }

  @Roles(...LIST_ROLES)
  @Delete('reports/lists/snapshots/:id')
  @HttpCode(204)
  async removeSnapshot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    await this.snapshots.remove(id, scope, user);
  }

  @Get('legal-entities/:id/list-settings')
  page(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope): Promise<ListSettingsPage> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    return this.settings.page(id);
  }

  @Roles(...LIST_ROLES)
  @Put('legal-entities/:id/list-settings/:section')
  async save(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @Body() dto: ListSectionSettingsDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<ListSettings> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const list = requiredSection(section);
    const { before, after, settings } = await this.settings.save(id, list, dto);
    const diff = settingsDiff(before, after);
    if (Object.keys(diff).length)
      await this.audit.log(
        'legal-entity',
        id,
        'UPDATE',
        { [`lists.${list}`]: [null, Object.keys(diff).join(', ')] },
        user,
      );
    return settings;
  }

  @Roles(...LIST_ROLES)
  @Post('legal-entities/:id/list-settings/:section/template')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_TEMPLATE_BYTES, files: 1 } }))
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @UploadedFile() file: UploadedTemplate | undefined,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
    @Req() req: Request,
  ): Promise<ListSettings> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const list = requiredSection(section);
    if (!file) throw new BadRequestException('Оберіть файл .docx');
    // multer gives the name in latin1
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (!/\.docx$/i.test(fileName)) throw new BadRequestException('Потрібен файл Word у форматі .docx');
    // the template goes into every list document later — a macro or a remote template must never get in
    await this.uploads.assertSafe(file.buffer, fileName, 'docx', { user, req });
    const settings = await this.settings.uploadTemplate(id, list, file.buffer, fileName);
    await this.audit.log('legal-entity', id, 'UPDATE', { [`lists.${list}.template`]: [null, fileName] }, user);
    return settings;
  }

  @Roles(...LIST_ROLES)
  @Delete('legal-entities/:id/list-settings/:section/template')
  async removeTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ): Promise<ListSettings> {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const list = requiredSection(section);
    const settings = await this.settings.removeTemplate(id, list);
    await this.audit.log('legal-entity', id, 'UPDATE', { [`lists.${list}.template`]: ['шаблон', null] }, user);
    return settings;
  }

  @Get('legal-entities/:id/list-settings/:section/template')
  async template(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @EntityScope() scope: Scope,
  ) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const { buffer, fileName } = await this.settings.template(id, requiredSection(section));
    return docxFile(buffer, fileName);
  }

  @Get('legal-entities/:id/list-settings/:section/example')
  async example(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @EntityScope() scope: Scope,
  ) {
    assertInScope(scope, id, ENTITY_NOT_FOUND);
    const list = requiredSection(section);
    return docxFile(await this.settings.example(id, list), `Шаблон — ${LIST_FILE_NAMES[list]}.docx`);
  }
}
