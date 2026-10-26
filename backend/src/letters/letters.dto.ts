import { IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { IsIsoDate } from '../common/validators.js';
import type { ListGroup } from '../military/dictionaries.js';
import type { LetterStatus, LetterType } from './entities/outgoing-letter.entity.js';

export class CreateChangeNoticeDto {
  @IsUUID() employeeId: string;

  /** Які зміни включити; якщо не задано — усі очікуючі. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) changeIds?: string[];

  @IsOptional() @IsIsoDate() date?: string;
  @IsOptional() @IsString() @MaxLength(50) number?: string;
}

export class CreateReportLetterDto {
  @IsIn(['LISTS', 'OPERATIONAL_REPORT']) type: Extract<LetterType, 'LISTS' | 'OPERATIONAL_REPORT'>;

  /** Дата, станом на яку формується звіт. */
  @IsIsoDate() reportDate: string;

  @IsOptional() @IsArray() @IsIn(['G1', 'G1R', 'G2', 'G2R', 'G3', 'G3R', 'G4', 'G4R'], { each: true })
  groups?: ListGroup[];

  /** Для витягу — конкретні працівники. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) employeeIds?: string[];

  @IsOptional() @IsUUID() tckId?: string;
  @IsOptional() @IsIsoDate() date?: string;
  @IsOptional() @IsString() @MaxLength(50) number?: string;
}

export class UpdateLetterDto {
  @IsOptional() @IsString() @MaxLength(50) number?: string;
  @IsOptional() @IsIsoDate() date?: string;
  @IsOptional() @IsString() @MaxLength(500) subject?: string;
  @IsOptional() @ValidateIf((o: UpdateLetterDto) => !!o.recipientEmail) @IsEmail() recipientEmail?: string;
  @IsOptional() @IsUUID() tckId?: string;
}

export class SendLetterDto {
  @IsOptional() @IsEmail() to?: string;
  @IsOptional() @ValidateIf((o: SendLetterDto) => !!o.cc) @IsEmail() cc?: string;
  @IsOptional() @IsString() @MaxLength(5000) message?: string;
}

export class LetterQueryDto {
  @IsOptional() @IsIn(['CHANGE_NOTICE', 'LISTS', 'OPERATIONAL_REPORT', 'OTHER']) type?: LetterType;
  @IsOptional() @IsIn(['DRAFT', 'SENT', 'FAILED']) status?: LetterStatus;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsString() year?: string;
}
