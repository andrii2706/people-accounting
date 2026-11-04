import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsIsoDate } from '../common/validators/validators.js';
import { OptionalStr } from '../common/validators/validators.js';

/**
 * System settings shared by all legal entities: warning terms and the mobilization term.
 * Requisites, quota and reminder addresses are edited in the legal entities.
 */
export class UpdateOrganizationDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Щонайменше 1 день' })
  @Max(365, { message: 'Не більше 365 днів' })
  alertDays?: number;
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Щонайменше 1 день' })
  @Max(60, { message: 'Не більше 60 днів' })
  notifyDeadlineDays?: number;

  /** Manual override of the mobilization end (normally filled from the presidential decrees). */
  @IsOptional() @IsIsoDate({ nullable: true }) mobilizationUntil?: string | null;
  @OptionalStr(300) mobilizationDecree?: string;
}
