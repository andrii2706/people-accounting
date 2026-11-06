import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, EntityScope } from '../common/decorators/auth.decorators.js';
import { docxFile } from '../common/utils/file-response.utils.js';
import {
  CreateChangeNoticeDto,
  CreateChangeNoticesDto,
  CreateExternalNoticeDto,
  NoticeQueryDto,
  CreateReportLetterDto,
  LetterQueryDto,
  UpdateLetterDto,
} from './letters.dto.js';
import { LettersService } from './letters.service.js';
import type { AuthUser, Scope } from '../shared/interfaces/auth.interface.js';
import { scopedEntity } from '../common/utils/entity-scope.utils.js';

@ApiTags('letters')
@Controller('letters')
export class LettersController {
  constructor(
    private readonly letters: LettersService,
    private readonly audit: AuditService,
  ) {}

  /** Letters of the user's legal entity (the main administrator — of all). */
  @Get()
  list(@Query() query: LetterQueryDto, @EntityScope() scope: Scope) {
    return this.letters.list(query, scope);
  }

  /** Notices for several employees: one letter per TCK. Returns the created letters. */
  @Post('change-notices')
  async createChangeNotices(
    @Body() dto: CreateChangeNoticesDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    await this.letters.assertEmployees(dto.employeeIds, scope);
    return this.letters.createChangeNotices(dto, user);
  }

  @Post('change-notice')
  async createChangeNotice(
    @Body() dto: CreateChangeNoticeDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    await this.letters.assertEmployees([dto.employeeId], scope);
    return this.letters.createChangeNotice(dto, user);
  }

  /** A notice sent before the system — entered by hand with its real number and date. */
  @Post('external-notice')
  async createExternalNotice(
    @Body() dto: CreateExternalNoticeDto,
    @CurrentUser() user: AuthUser,
    @EntityScope() scope: Scope,
  ) {
    await this.letters.assertEmployees([dto.employeeId], scope);
    return this.letters.createExternalNotice(dto, user);
  }

  /** Register a letter with the lists / operational report. */
  @Post('report')
  async createReport(@Body() dto: CreateReportLetterDto, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    // a report is formed for the user's legal entity (the main administrator chooses it)
    dto.legalEntityId = scopedEntity(scope, dto.legalEntityId) ?? undefined;
    await this.letters.assertEmployees(dto.employeeIds ?? [], scope);
    return this.letters.createReportLetter(dto, user);
  }

  /** Envelope labels for one or many letters: ?ids=<uuid>,<uuid> */
  @Get('labels')
  async labels(@Query('ids') ids: string | undefined, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    const list = (ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.some((id) => !isUUID(id))) throw new BadRequestException('ids: очікуються UUID листів через кому');
    const { buffer, filename } = await this.letters.labels(list, scope);
    await this.audit.log(
      'letter',
      list.length === 1 ? list[0] : null,
      'EXPORT',
      { labels: [null, list.join(',')] },
      user,
    );
    return docxFile(buffer, filename);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope) {
    await this.letters.assertAccess(id, scope);
    return this.letters.get(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLetterDto, @EntityScope() scope: Scope) {
    await this.letters.assertAccess(id, scope);
    return this.letters.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @EntityScope() scope: Scope) {
    await this.letters.assertAccess(id, scope);
    return this.letters.remove(id);
  }

  @Get(':id/docx')
  async docx(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    await this.letters.assertAccess(id, scope);
    const { buffer, filename } = await this.letters.document(id);
    await this.audit.log('letter', id, 'EXPORT', { file: [null, filename] }, user);
    return docxFile(buffer, filename);
  }

  /** Mark as handed over to the TCK (Ukrposhta, by hand, document management system, e-cabinet). */
  @Post(':id/mark-sent')
  @HttpCode(200)
  async markSent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    await this.letters.assertAccess(id, scope);
    return this.letters.markSent(id, user);
  }
}

/** Stored change notices (Annex 4) — history per employee and re-printing of a single notice. */
@ApiTags('letters')
@Controller('change-notices')
export class ChangeNoticesController {
  constructor(
    private readonly letters: LettersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: NoticeQueryDto, @EntityScope() scope: Scope) {
    return this.letters.notices(query, scope);
  }

  @Get(':id/docx')
  async docx(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    const { buffer, filename, letterId } = await this.letters.noticeDocument(id, scope);
    await this.audit.log('letter', letterId, 'EXPORT', { notice: [null, filename] }, user);
    return docxFile(buffer, filename);
  }
}
