import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Rule } from '../common/validators/validators.js';
import { MESSAGE, PATTERN } from '../military/employee-rules.js';

export class CreateTckDto {
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть назву' })
  @MaxLength(300, { message: 'Не більше 300 символів' })
  name: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'Не більше 300 символів' }) nameGenitive?: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'Не більше 300 символів' }) address?: string;
  @IsOptional() @Rule((v: string) => PATTERN.postalCode.test(v), MESSAGE.postalCode) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(200, { message: 'Не більше 200 символів' }) phone?: string;
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Не більше 200 символів' })
  @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email)
  email?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateTckDto extends PartialType(CreateTckDto) {}

/** TCK directory moved from another database (npm run tck:export → Налаштування → ТЦК → Імпорт). */
export class ImportTckDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CreateTckDto)
  items: CreateTckDto[];
}
