import { applyDecorators } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import type { AccessRole } from '../shared/interfaces/legal-entity.interface.js';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { OptionalStr, PhoneField, Rule } from '../common/validators/validators.js';
import { MESSAGE, PATTERN } from '../military/employee-rules.js';
import { ACCESS_ROLES } from './legal-entities.constants.js';

const Required = (max: number, message: string) =>
  applyDecorators(IsString(), IsNotEmpty({ message }), MaxLength(max, { message: MESSAGE.tooLong(max) }));

export class CreateLegalEntityDto {
  @Required(500, 'Вкажіть повну назву') fullName: string;
  @OptionalStr(500) nameLocative?: string;
  @OptionalStr(300) shortName?: string;
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть код ЄДРПОУ' })
  @Rule((v: string) => PATTERN.companyCode.test(v), MESSAGE.companyCode)
  edrpou: string;
  @OptionalStr(500) address?: string;
  @OptionalStr(5) @Rule((v: string) => PATTERN.postalCode.test(v), MESSAGE.postalCode) postalCode?: string;
  @PhoneField() phone?: string;
  @OptionalStr(200) @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email) email?: string;
  @OptionalStr(30) letterNumberPrefix?: string;
  @OptionalStr(200) headPosition?: string;
  @OptionalStr(200) headName?: string;
  @OptionalStr(200) responsibleName?: string;
  @OptionalStr(200) responsiblePosition?: string;
  @PhoneField() responsiblePhone?: string;
  /** Reservation quota — how many employees may be reserved. null — not set. */
  @IsOptional()
  @ValidateIf((o: CreateLegalEntityDto) => o.reservationQuota !== null)
  @IsInt({ message: 'Квота — ціле число' })
  @Min(0, { message: 'Не менше 0' })
  @Max(100000, { message: 'Не більше 100 000' })
  reservationQuota?: number | null;
  @OptionalStr(300) reservationQuotaBasis?: string;
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

export class UpdateLegalEntityDto extends PartialType(CreateLegalEntityDto) {}

/** Access to the system for the head / the responsible person: login e-mail and the role. */
export class GrantAccessDto {
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть email — це логін для входу' })
  @MaxLength(200, { message: MESSAGE.tooLong(200) })
  @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email)
  email: string;

  @IsOptional()
  @IsIn(ACCESS_ROLES, { message: 'Роль: працівник з обліку, директор або адміністратор' })
  role?: AccessRole;
}

/** A new head / responsible person: the details replace the current ones (no history). */
export class ChangePersonDto {
  @Required(200, 'Вкажіть ім’я та ПРІЗВИЩЕ') fullName: string;
  @OptionalStr(200) position?: string;
  @PhoneField() phone?: string;
  /** Turn off the system access of the previous person. */
  @IsOptional() @IsBoolean() revokePrevious?: boolean;
  /** Give the new person access right away (login e-mail). */
  @IsOptional()
  @MaxLength(200, { message: MESSAGE.tooLong(200) })
  @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email)
  email?: string;
  @IsOptional()
  @IsIn(ACCESS_ROLES, { message: 'Роль: працівник з обліку, директор або адміністратор' })
  role?: AccessRole;
}

export class RegistryLookupDto {
  @IsString()
  @Rule((v: string) => PATTERN.companyCode.test(v), MESSAGE.companyCode)
  edrpou: string;
}
