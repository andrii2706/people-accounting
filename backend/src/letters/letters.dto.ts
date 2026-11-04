import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsIsoDate, NotFuture } from '../common/validators/validators.js';
import type { ListGroup } from '../shared/interfaces/dictionary.interface.js';
import type { LetterType, LetterStatus } from '../shared/interfaces/letter.interface.js';

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

  @IsOptional()
  @IsArray()
  @IsIn(['G1', 'G1R', 'G2', 'G2R', 'G3', 'G3R', 'G4', 'G4R'], { each: true })
  groups?: ListGroup[];

  /** For an extract — specific employees. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) employeeIds?: string[];

  @IsOptional() @IsUUID() tckId?: string;
  /** Extract about the people registered at `tckId` (lists only). */
  @IsOptional() @IsBoolean() byTck?: boolean;
  /** Sender; required when there are several legal entities. */
  @IsOptional() @IsUUID() legalEntityId?: string;
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

/**
 * A notice sent to the TCK before the system (or outside it): entered by hand with its real number and date,
 * so the history of the employee is complete. It can close pending changes it reported.
 */
export class CreateExternalNoticeDto {
  @IsUUID('all', { message: 'Оберіть працівника' }) employeeId: string;

  @IsString()
  @IsNotEmpty({ message: 'Вкажіть вихідний номер листа' })
  @MaxLength(50, { message: 'Не більше 50 символів' })
  number: string;

  @IsIsoDate() @NotFuture() date: string;

  @IsIn(['HIRE', 'DISMISSAL', 'DATA'], { message: 'Оберіть тип повідомлення' })
  changeType: 'HIRE' | 'DISMISSAL' | 'DATA';

  /** Date the reported change took effect; the letter date when omitted. */
  @IsOptional() @IsIsoDate() effectiveDate?: string;

  /** TCK the notice was sent to; the employee's TCK when omitted. */
  @IsOptional() @IsUUID('all', { message: 'Оберіть ТЦК зі списку' }) tckId?: string;

  /** What was reported, in a few words (shown in the history). */
  @IsOptional() @IsString() @MaxLength(1000, { message: 'Не більше 1000 символів' }) description?: string;

  /** Pending changes this notice reported — they leave the queue. */
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) changeIds?: string[];
}
