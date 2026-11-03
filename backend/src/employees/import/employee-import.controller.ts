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
import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import { EmployeeImportService } from './employee-import.service.js';
import type { AuthUser } from '../../shared/interfaces/auth.interface.js';
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
  preview(@UploadedFile() file: UploadedTable | undefined) {
    if (!file) throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['Оберіть файл'] });
    // multer gives the name in latin1
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.importer.preview(file.buffer, fileName);
  }

  @Post('check')
  @HttpCode(200)
  check(@Body() dto: ImportRowsDto) {
    return this.importer.check(dto.rows);
  }

  @Post('commit')
  async commit(@Body() dto: ImportCommitDto, @CurrentUser() user: AuthUser) {
    const result = await this.importer.commit(
      dto.rows,
      {
        hireNotices:
          dto.hireNotices === true ? 'ALL' : dto.hireNotices === false ? 'NONE' : (dto.hireNotices ?? 'RECENT'),
        fileName: dto.fileName,
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
