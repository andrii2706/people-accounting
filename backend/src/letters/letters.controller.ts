import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser, CurrentUser } from '../common/auth.js';
import { docxFile } from '../reports/reports.controller.js';
import {
  CreateChangeNoticeDto,
  CreateReportLetterDto,
  LetterQueryDto,
  SendLetterDto,
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

  /** Сформувати повідомлення ТЦК про зміни облікових даних працівника. */
  @Post('change-notice')
  createChangeNotice(@Body() dto: CreateChangeNoticeDto, @CurrentUser() user: AuthUser) {
    return this.letters.createChangeNotice(dto, user);
  }

  /** Зареєструвати лист зі списками / відомістю оперативного обліку. */
  @Post('report')
  createReport(@Body() dto: CreateReportLetterDto, @CurrentUser() user: AuthUser) {
    return this.letters.createReportLetter(dto, user);
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

  @Post(':id/send')
  @HttpCode(200)
  send(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendLetterDto, @CurrentUser() user: AuthUser) {
    return this.letters.send(id, dto, user);
  }

  /** Позначити як надісланий іншим способом (Укрпошта, нарочно). */
  @Post(':id/mark-sent')
  @HttpCode(200)
  markSent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.letters.markSent(id, user);
  }
}
