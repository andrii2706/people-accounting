import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from '../../audit/audit.service.js';
import { CurrentUser, EntityScope } from '../../common/decorators/auth.decorators.js';
import { EmployeeImportService } from './employee-import.service.js';
import type { AuthUser, Scope } from '../../shared/interfaces/auth.interface.js';
import { scopedEntity } from '../../common/utils/entity-scope.utils.js';
import type { UploadedTable } from '../../shared/interfaces/import.interface.js';
import { MAX_IMPORT_FILE_BYTES } from './import.constants.js';
import { ImportCommitDto } from './employee-import.dto.js';
import { ImportRowsDto } from './employee-import.dto.js';

@ApiTags('employees')
@Controller('employees/import')
export class EmployeeImportController {
  constructor(
    private readonly importer: EmployeeImportService,
    private readonly audit: AuditService,
  ) {}

  @Get('template')
  async template(@Res() res: Response) {
    const buffer = await this.importer.template();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent('Шаблон імпорту працівників.xlsx')}`,
    );
    res.send(buffer);
  }

  /** Reads the file and returns the checked rows — nothing is saved. The file itself is not stored. */
  @Post('preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES, files: 1 } }))
  preview(@UploadedFile() file: UploadedTable | undefined, @EntityScope() scope: Scope) {
    if (!file) throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['Оберіть файл'] });
    // multer gives the name in latin1
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.importer.preview(file.buffer, fileName, scope);
  }

  @Post('check')
  @HttpCode(200)
  check(@Body() dto: ImportRowsDto, @EntityScope() scope: Scope) {
    return this.importer.check(dto.rows, scope);
  }

  @Post('commit')
  async commit(@Body() dto: ImportCommitDto, @CurrentUser() user: AuthUser, @EntityScope() scope: Scope) {
    const result = await this.importer.commit(
      dto.rows,
      {
        hireNotices:
          dto.hireNotices === true ? 'ALL' : dto.hireNotices === false ? 'NONE' : (dto.hireNotices ?? 'RECENT'),
        fileName: dto.fileName,
        // the employees join the user's legal entity (the main administrator chooses it)
        legalEntityId: scopedEntity(scope, dto.legalEntityId) ?? undefined,
      },
      user,
    );
    await this.audit.log(
      'employee',
      null,
      'CREATE',
      { import: [null, `${result.created} працівн., ${dto.fileName ?? 'файл'}`] },
      user,
    );
    return result;
  }
}
