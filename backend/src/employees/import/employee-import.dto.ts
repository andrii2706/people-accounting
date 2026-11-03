import type { HireNoticesMode } from '../../shared/interfaces/import.interface.js';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_IMPORT_ROWS } from './import.constants.js';
import type { ImportValues } from '../../shared/interfaces/import.interface.js';

export class ImportIssueDto {
  @IsString() @MaxLength(100) field: string;
  @IsString() @MaxLength(500) message: string;
}

export class ImportRowDto {
  @IsInt() rowNumber: number;
  /** CreateEmployeeDto values — validated by the service with the same DTO. */
  @IsObject() values: ImportValues;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ImportIssueDto) issues: ImportIssueDto[];
}

export class ImportRowsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}

export class ImportCommitDto extends ImportRowsDto {
  /** RECENT (default) / ALL / NONE; true / false are accepted as ALL / NONE for older clients. */
  @IsOptional() @IsIn([true, false, 'RECENT', 'ALL', 'NONE']) hireNotices?: boolean | HireNoticesMode;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
}
