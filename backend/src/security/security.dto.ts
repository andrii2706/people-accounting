import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import type { SecurityEventKind } from '../shared/interfaces/security.interface.js';
import { SECURITY_PAGE_MAX, SECURITY_POLICIES } from './security.constants.js';

export class SecurityEventsQueryDto {
  @IsOptional()
  @IsIn(Object.keys(SECURITY_POLICIES), { message: 'Невідомий вид події' })
  kind?: SecurityEventKind;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(SECURITY_PAGE_MAX) size?: number;
}

export class ExportTraceDto {
  @Matches(/^[0-9a-fA-F]{64}$/, { message: 'Потрібен SHA-256 файлу (64 шістнадцяткові символи)' })
  sha256: string;
}
