import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser, CurrentUser } from '../common/auth.js';
import { docxFile } from '../reports/reports.controller.js';
import {
  CreateChangeNoticeDto,
  CreateChangeNoticesDto,
  NoticeQueryDto,
  CreateReportLetterDto,
  LetterQueryDto,
  UpdateLetterDto,
} from './letters.dto.js';
import { LettersService } from './letters.service.js';

@ApiTags('letters')
@Controller('letters')
export class LettersController {
  constructor(
    private readonly letters: LettersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: LetterQueryDto) {
    return this.letters.list(query);
  }

  /** Notices for several employees: one letter per TCK. Returns the created letters. */
  @Post('change-notices')
  createChangeNotices(@Body() dto: CreateChangeNoticesDto, @CurrentUser() user: AuthUser) {
    return this.letters.createChangeNotices(dto, user);
  }

  /** Create a TCK notice about changes of an employee's registration data. */
  @Post('change-notice')
  createChangeNotice(@Body() dto: CreateChangeNoticeDto, @CurrentUser() user: AuthUser) {
    return this.letters.createChangeNotice(dto, user);
  }

  /** Register a letter with the lists / operational report. */
  @Post('report')
  createReport(@Body() dto: CreateReportLetterDto, @CurrentUser() user: AuthUser) {
    return this.letters.createReportLetter(dto, user);
  }

  /** Envelope labels for one or many letters: ?ids=<uuid>,<uuid> */
  @Get('labels')
  async labels(@Query('ids') ids: string | undefined, @CurrentUser() user: AuthUser) {
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (list.some((id) => !isUUID(id))) throw new BadRequestException('ids: очікуються UUID листів через кому');
    const { buffer, filename } = await this.letters.labels(list);
    await this.audit.log('letter', list.length === 1 ? list[0] : null, 'EXPORT', { labels: [null, list.join(',')] }, user);
    return docxFile(buffer, filename);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.letters.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLetterDto) {
    return this.letters.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.letters.remove(id);
  }

  @Get(':id/docx')
  async docx(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const { buffer, filename } = await this.letters.document(id);
    await this.audit.log('letter', id, 'EXPORT', { file: [null, filename] }, user);
    return docxFile(buffer, filename);
  }

  /** Mark as handed over to the TCK (Ukrposhta, by hand, document management system, e-cabinet). */
  @Post(':id/mark-sent')
  @HttpCode(200)
  markSent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
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
  list(@Query() query: NoticeQueryDto) {
    return this.letters.notices(query);
  }

  @Get(':id/docx')
  async docx(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const { buffer, filename, letterId } = await this.letters.noticeDocument(id);
    await this.audit.log('letter', letterId, 'EXPORT', { notice: [null, filename] }, user);
    return docxFile(buffer, filename);
  }
}
