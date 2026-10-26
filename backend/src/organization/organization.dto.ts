import { applyDecorators } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsIsoDate, Rule } from '../common/validators.js';
import { MESSAGE, PATTERN } from '../military/employee-rules.js';

const Str = (max: number) => applyDecorators(IsOptional(), IsString(), MaxLength(max, { message: MESSAGE.tooLong(max) }));

export class UpdateOrganizationDto {
  @Str(500) fullName?: string;
  @Str(500) nameLocative?: string;
  @Str(300) shortName?: string;
  @Str(20) @Rule((v: string) => /^\d{8,10}$/.test(v), '8 цифр (ЄДРПОУ) або 10 (РНОКПП ФОП)') edrpou?: string;
  @Str(500) address?: string;
  @Str(100) phone?: string;
  @Str(200) @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email) email?: string;
  @Str(200) headPosition?: string;
  @Str(200) headName?: string;
  @Str(30) letterNumberPrefix?: string;
  @IsOptional() @IsInt() @Min(1, { message: 'Щонайменше 1 день' }) @Max(365, { message: 'Не більше 365 днів' }) alertDays?: number;
  @IsOptional() @IsInt() @Min(1, { message: 'Щонайменше 1 день' }) @Max(60, { message: 'Не більше 60 днів' }) notifyDeadlineDays?: number;
}

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
