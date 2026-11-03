import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { NIL_UUID } from '../common/constants/common.constants.js';
import { docxFile } from '../common/utils/file-response.utils.js';
import { parseListGroups, parseReportDate } from './utils/report-params.utils.js';
import { CurrentUser } from '../common/decorators/auth.decorators.js';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  dashboard(@Query('date') date?: string) {
    return this.reports.dashboard(parseReportDate(date));
  }

  @ApiQuery({ name: 'groups', required: false, description: 'G1,G1R,G2,…' })
  @Get('lists')
  lists(@Query('date') date?: string, @Query('groups') groups?: string) {
    return this.reports.lists(parseReportDate(date), parseListGroups(groups));
  }

  @ApiQuery({ name: 'ids', required: false, description: 'id працівників для витягу через кому' })
  @Get('lists/docx')
  async listsDocx(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('groups') groups?: string,
    @Query('ids') ids?: string,
  ) {
    const d = parseReportDate(date);
    await this.audit.log(
      'report',
      NIL_UUID,
      'EXPORT',
      { lists: [null, `${d} ${groups ?? 'all'}${ids ? ` ids=${ids}` : ''}`] },
      user,
    );
    const buffer = await this.reports.listsDocx(d, parseListGroups(groups), ids?.split(',').filter(Boolean));
    return docxFile(buffer, `${ids ? 'Витяг' : 'Списки'} військового обліку ${d}.docx`);
  }

  @Get('operational')
  operational(@Query('date') date?: string) {
    return this.reports.operational(parseReportDate(date));
  }

  @Get('operational/docx')
  async operationalDocx(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    const d = parseReportDate(date);
    await this.audit.log('report', NIL_UUID, 'EXPORT', { operational: [null, d] }, user);
    return docxFile(await this.reports.operationalDocx(d), `Відомість оперативного обліку ${d}.docx`);
  }
}
