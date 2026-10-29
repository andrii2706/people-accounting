import { applyDecorators } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IsIsoDate, Rule } from '../common/validators.js';
import { MESSAGE, PATTERN } from '../military/employee-rules.js';

const Str = (max: number) => applyDecorators(IsOptional(), IsString(), MaxLength(max, { message: MESSAGE.tooLong(max) }));

export class UpdateOrganizationDto {
  @Str(500) fullName?: string;
  @Str(500) nameLocative?: string;
  @Str(300) shortName?: string;
  @Str(20) @Rule((v: string) => /^\d{8,10}$/.test(v), '8 цифр (ЄДРПОУ) або 10 (РНОКПП ФОП)') edrpou?: string;
  @Str(500) address?: string;
  @IsOptional() @Matches(/^(\d{5})?$/, { message: 'Поштовий індекс — 5 цифр' }) postalCode?: string;
  @Str(100) phone?: string;
  @Str(200) @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email) email?: string;
  @Str(200) headPosition?: string;
  @Str(200) headName?: string;
  @Str(30) letterNumberPrefix?: string;
  @IsOptional() @IsInt() @Min(1, { message: 'Щонайменше 1 день' }) @Max(365, { message: 'Не більше 365 днів' }) alertDays?: number;
  @IsOptional() @IsInt() @Min(1, { message: 'Щонайменше 1 день' }) @Max(60, { message: 'Не більше 60 днів' }) notifyDeadlineDays?: number;

  /** Reservation quota — how many employees the company may reserve. null — not set. */
  @IsOptional() @ValidateIf((o: UpdateOrganizationDto) => o.reservationQuota !== null)
  @IsInt({ message: 'Квота — ціле число' }) @Min(0, { message: 'Не менше 0' }) @Max(100000)
  reservationQuota?: number | null;
  @Str(300) reservationQuotaBasis?: string;

  /** Manual override of the mobilization end (normally filled from the presidential decrees). */
  @IsOptional() @IsIsoDate({ nullable: true }) mobilizationUntil?: string | null;
  @Str(300) mobilizationDecree?: string;

  /** Extra e-mail addresses for reminders, comma-separated. */
  @Str(500)
  @Rule((v: string) => v.split(',').map((x) => x.trim()).filter(Boolean).every((x) => PATTERN.email.test(x)), 'Перелік email через кому')
  notifyEmails?: string;
}

/** Change of the head (director): from which date the new head signs the documents. */
export class CreateOrganizationHeadDto {
  @IsString() @IsNotEmpty({ message: 'Вкажіть посаду' }) @MaxLength(200, { message: MESSAGE.tooLong(200) }) position: string;
  @IsString() @IsNotEmpty({ message: 'Вкажіть ім’я та ПРІЗВИЩЕ' }) @MaxLength(200, { message: MESSAGE.tooLong(200) }) fullName: string;
  @Str(50) orderNumber?: string;
  @IsIsoDate() validFrom: string;
  @IsOptional() @IsIsoDate({ nullable: true })
  @Rule((v: string, dto) => !dto.validFrom || v >= (dto.validFrom as string), 'Раніше за дату початку')
  validTo?: string | null;
}

export class UpdateOrganizationHeadDto extends PartialType(CreateOrganizationHeadDto) {}

export class CreateResponsiblePersonDto {
  @IsString() @IsNotEmpty({ message: 'Вкажіть ім’я та прізвище' }) @MaxLength(200, { message: MESSAGE.tooLong(200) }) fullName: string;
  @Str(200) position?: string;
  @Str(100) phone?: string;
  @Str(50) orderNumber?: string;
  @IsIsoDate() validFrom: string;
  @IsOptional() @IsIsoDate({ nullable: true })
  @Rule((v: string, dto) => !dto.validFrom || v >= (dto.validFrom as string), 'Раніше за дату початку')
  validTo?: string | null;
}

export class UpdateResponsiblePersonDto extends PartialType(CreateResponsiblePersonDto) {}
