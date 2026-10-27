import { BadRequestException, Body, Controller, Get, HttpCode, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { Response } from 'express';
import { AuditService } from '../../audit/audit.service.js';
import { type AuthUser, CurrentUser } from '../../common/auth.js';
import { EmployeeImportService } from './employee-import.service.js';
import { MAX_IMPORT_ROWS } from './import-reader.js';
import type { ImportValues } from './import-rows.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** The part of the multer file we use (kept in memory, never written to disk). */
interface UploadedTable {
  originalname: string;
  buffer: Buffer;
}

class ImportIssueDto {
  @IsString() @MaxLength(100) field: string;
  @IsString() @MaxLength(500) message: string;
}

class ImportRowDto {
  @IsInt() rowNumber: number;
  /** CreateEmployeeDto values — validated by the service with the same DTO. */
  @IsObject() values: ImportValues;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ImportIssueDto) issues: ImportIssueDto[];
}

class ImportRowsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_IMPORT_ROWS) @ValidateNested({ each: true }) @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}

class ImportCommitDto extends ImportRowsDto {
  @IsOptional() @IsBoolean() hireNotices?: boolean;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
}

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
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('Шаблон імпорту працівників.xlsx')}`);
    res.send(buffer);
  }

  /** Reads the file and returns the checked rows — nothing is saved. The file itself is not stored. */
  @Post('preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
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
    const result = await this.importer.commit(dto.rows, { hireNotices: dto.hireNotices ?? false, fileName: dto.fileName }, user);
    await this.audit.log('employee', null, 'CREATE', { import: [null, `${result.created} працівн., ${dto.fileName ?? 'файл'}`] }, user);
    return result;
  }
}
