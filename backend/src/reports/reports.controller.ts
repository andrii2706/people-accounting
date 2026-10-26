import { BadRequestException, Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { AuditService, NIL_UUID } from '../audit/audit.service.js';
import { type AuthUser, CurrentUser } from '../common/auth.js';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { isIsoDate, todayIso } from '../common/utils/dates.js';
import { type ListGroup, LIST_GROUPS } from '../military/dictionaries.js';
import { ReportsService } from './reports.service.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function docxFile(buffer: Buffer, filename: string) {
  return new StreamableFile(buffer, {
    type: DOCX_MIME,
    disposition: `attachment; filename="document.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}

function parseDate(value?: string) {
  if (!value) return todayIso();
  if (!isIsoDate(value)) throw new BadRequestException('date: очікується РРРР-ММ-ДД');
  return value;
}

function parseGroups(value?: string): ListGroup[] {
  if (!value) return LIST_GROUPS;
  const groups = value.split(',').map((g) => g.trim()) as ListGroup[];
  if (groups.some((g) => !LIST_GROUPS.includes(g))) throw new BadRequestException('Невідома група списку');
  return groups;
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  dashboard(@Query('date') date?: string) {
    return this.reports.dashboard(parseDate(date));
  }

  @ApiQuery({ name: 'groups', required: false, description: 'G1,G1R,G2,…' })
  @Get('lists')
  lists(@Query('date') date?: string, @Query('groups') groups?: string) {
    return this.reports.lists(parseDate(date), parseGroups(groups));
  }

  @ApiQuery({ name: 'ids', required: false, description: 'id працівників для витягу через кому' })
  @Get('lists/docx')
  async listsDocx(@CurrentUser() user: AuthUser, @Query('date') date?: string, @Query('groups') groups?: string, @Query('ids') ids?: string) {
    const d = parseDate(date);
    await this.audit.log('report', NIL_UUID, 'EXPORT', { lists: [null, `${d} ${groups ?? 'all'}${ids ? ` ids=${ids}` : ''}`] }, user);
    const buffer = await this.reports.listsDocx(d, parseGroups(groups), ids?.split(',').filter(Boolean));
    return docxFile(buffer, `${ids ? 'Витяг' : 'Списки'} військового обліку ${d}.docx`);
  }

  @Get('operational')
  operational(@Query('date') date?: string) {
    return this.reports.operational(parseDate(date));
  }

  @Get('operational/docx')
  async operationalDocx(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    const d = parseDate(date);
    await this.audit.log('report', NIL_UUID, 'EXPORT', { operational: [null, d] }, user);
    return docxFile(await this.reports.operationalDocx(d), `Відомість оперативного обліку ${d}.docx`);
  }
}
