import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IsIsoDate, Rule } from '../common/validators/validators.js';
import { MESSAGE, PATTERN } from '../military/employee-rules.js';
import { OptionalStr } from '../common/validators/validators.js';

export class UpdateOrganizationDto {
  @OptionalStr(500) fullName?: string;
  @OptionalStr(500) nameLocative?: string;
  @OptionalStr(300) shortName?: string;
  @OptionalStr(20) @Rule((v: string) => PATTERN.companyCode.test(v), MESSAGE.companyCode) edrpou?: string;
  @OptionalStr(500) address?: string;
  @OptionalStr(5) @Rule((v: string) => PATTERN.postalCode.test(v), MESSAGE.postalCode) postalCode?: string;
  @OptionalStr(100) phone?: string;
  @OptionalStr(200) @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email) email?: string;
  @OptionalStr(200) headPosition?: string;
  @OptionalStr(200) headName?: string;
  @OptionalStr(30) letterNumberPrefix?: string;
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

  /** Reservation quota — how many employees the company may reserve. null — not set. */
  @IsOptional()
  @ValidateIf((o: UpdateOrganizationDto) => o.reservationQuota !== null)
  @IsInt({ message: 'Квота — ціле число' })
  @Min(0, { message: 'Не менше 0' })
  @Max(100000, { message: 'Не більше 100 000' })
  reservationQuota?: number | null;
  @OptionalStr(300) reservationQuotaBasis?: string;

  /** Manual override of the mobilization end (normally filled from the presidential decrees). */
  @IsOptional() @IsIsoDate({ nullable: true }) mobilizationUntil?: string | null;
  @OptionalStr(300) mobilizationDecree?: string;

  /** Extra e-mail addresses for reminders, comma-separated. */
  @OptionalStr(500)
  @Rule(
    (v: string) =>
      v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .every((x) => PATTERN.email.test(x)),
    MESSAGE.emailList,
  )
  notifyEmails?: string;
}

/** Change of the head (director): from which date the new head signs the documents. */
export class CreateOrganizationHeadDto {
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть посаду' })
  @MaxLength(200, { message: MESSAGE.tooLong(200) })
  position: string;
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я та ПРІЗВИЩЕ' })
  @MaxLength(200, { message: MESSAGE.tooLong(200) })
  fullName: string;
  @OptionalStr(50) orderNumber?: string;
  @IsIsoDate() validFrom: string;
  @IsOptional()
  @IsIsoDate({ nullable: true })
  @Rule((v: string, dto) => !dto.validFrom || v >= (dto.validFrom as string), 'Раніше за дату початку')
  validTo?: string | null;
}

export class UpdateOrganizationHeadDto extends PartialType(CreateOrganizationHeadDto) {}

export class CreateResponsiblePersonDto {
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я та прізвище' })
  @MaxLength(200, { message: MESSAGE.tooLong(200) })
  fullName: string;
  @OptionalStr(200) position?: string;
  @OptionalStr(100) phone?: string;
  @OptionalStr(50) orderNumber?: string;
  @IsIsoDate() validFrom: string;
  @IsOptional()
  @IsIsoDate({ nullable: true })
  @Rule((v: string, dto) => !dto.validFrom || v >= (dto.validFrom as string), 'Раніше за дату початку')
  validTo?: string | null;
}

export class UpdateResponsiblePersonDto extends PartialType(CreateResponsiblePersonDto) {}
