import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsIsoDate } from '../common/validators.js';
import type { ListGroup } from '../military/dictionaries.js';
import type { LetterStatus, LetterType } from './entities/outgoing-letter.entity.js';

export class CreateChangeNoticeDto {
  @IsUUID() employeeId: string;

  /** Which changes to include; all pending ones when omitted. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) changeIds?: string[];

  @IsOptional() @IsIsoDate() date?: string;
  @IsOptional() @IsString() @MaxLength(50) number?: string;
}

/**
 * Notices for several employees at once. Employees are grouped by their TCK:
 * one letter (with one cover letter and inventory) is created per TCK.
 */
export class CreateChangeNoticesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Оберіть хоча б одного працівника' })
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  employeeIds: string[];

  /** Which changes to include; all pending changes of the selected employees when omitted. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) changeIds?: string[];

  @IsOptional() @IsIsoDate() date?: string;
}

export class NoticeQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() letterId?: string;
}

export class CreateReportLetterDto {
  @IsIn(['LISTS', 'OPERATIONAL_REPORT']) type: Extract<LetterType, 'LISTS' | 'OPERATIONAL_REPORT'>;

  /** Date the report is made as of. */
  @IsIsoDate() reportDate: string;

  @IsOptional() @IsArray() @IsIn(['G1', 'G1R', 'G2', 'G2R', 'G3', 'G3R', 'G4', 'G4R'], { each: true })
  groups?: ListGroup[];

  /** For an extract — specific employees. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) employeeIds?: string[];

  @IsOptional() @IsUUID() tckId?: string;
  @IsOptional() @IsIsoDate() date?: string;
  @IsOptional() @IsString() @MaxLength(50) number?: string;
}

export class UpdateLetterDto {
  @IsOptional() @IsString() @MaxLength(50) number?: string;
  @IsOptional() @IsIsoDate() date?: string;
  @IsOptional() @IsString() @MaxLength(500) subject?: string;
  @IsOptional() @IsUUID() tckId?: string;
}

export class LetterQueryDto {
  @IsOptional() @IsIn(['CHANGE_NOTICE', 'LISTS', 'OPERATIONAL_REPORT', 'OTHER']) type?: LetterType;
  @IsOptional() @IsIn(['DRAFT', 'SENT']) status?: LetterStatus;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsString() year?: string;
}
