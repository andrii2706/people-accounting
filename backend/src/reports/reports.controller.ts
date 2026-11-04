import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { NIL_UUID } from '../common/constants/common.constants.js';
import { docxFile } from '../common/utils/file-response.utils.js';
import { parseEntityId, parseListGroups, parseReportDate, parseTckId } from './utils/report-params.utils.js';
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
  @ApiQuery({ name: 'entity', required: false, description: 'id юридичної особи; без нього — усі' })
  @Get('lists')
  lists(@Query('date') date?: string, @Query('groups') groups?: string, @Query('entity') entity?: string) {
    return this.reports.lists(parseReportDate(date), {
      groups: parseListGroups(groups),
      legalEntityId: parseEntityId(entity),
    });
  }

  @ApiQuery({ name: 'entity', required: false, description: 'id юридичної особи; без нього — усі' })
  @Get('extracts')
  extracts(@Query('date') date?: string, @Query('entity') entity?: string) {
    return this.reports.extracts(parseReportDate(date), parseEntityId(entity));
  }

  @ApiQuery({ name: 'ids', required: false, description: 'id працівників для витягу через кому' })
  @ApiQuery({ name: 'tck', required: false, description: 'id ТЦК — витяг про осіб, які перебувають там на обліку' })
  @Get('lists/docx')
  async listsDocx(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('groups') groups?: string,
    @Query('ids') ids?: string,
    @Query('entity') entity?: string,
    @Query('tck') tck?: string,
  ) {
    const d = parseReportDate(date);
    const tckId = parseTckId(tck);
    await this.audit.log(
      'report',
      NIL_UUID,
      'EXPORT',
      { lists: [null, `${d} ${groups ?? 'all'}${ids ? ` ids=${ids}` : ''}${tckId ? ` tck=${tckId}` : ''}`] },
      user,
    );
    const buffer = await this.reports.listsDocx(d, {
      groups: parseListGroups(groups),
      onlyIds: ids?.split(',').filter(Boolean),
      legalEntityId: parseEntityId(entity),
      tckId,
    });
    return docxFile(buffer, `${ids || tckId ? 'Витяг' : 'Списки'} військового обліку ${d}.docx`);
  }

  @Get('operational')
  operational(@Query('date') date?: string, @Query('entity') entity?: string) {
    return this.reports.operational(parseReportDate(date), parseEntityId(entity));
  }

  @Get('operational/docx')
  async operationalDocx(@CurrentUser() user: AuthUser, @Query('date') date?: string, @Query('entity') entity?: string) {
    const d = parseReportDate(date);
    await this.audit.log('report', NIL_UUID, 'EXPORT', { operational: [null, d] }, user);
    return docxFile(
      await this.reports.operationalDocx(d, null, parseEntityId(entity)),
      `Відомість оперативного обліку ${d}.docx`,
    );
  }
}
