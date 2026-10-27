import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { passwordProblems } from '../common/password-policy.js';
import { Rule } from '../common/validators.js';
import type { UserRole } from './user.entity.js';

const ROLES: UserRole[] = ['ADMIN', 'HR'];

export class CreateUserDto {
  @IsEmail({}, { message: 'Некоректний email' })
  @MaxLength(200)
  email: string;

  /** Temporary password — the user changes it on first sign-in. */
  @IsString()
  @MaxLength(200)
  @Rule((v: string) => passwordProblems(v).length === 0, 'Пароль: щонайменше 12 символів, літери й цифри')
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я' })
  @MaxLength(200, { message: 'Не більше 200 символів' })
  fullName: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Не більше 200 символів' })
  fullName?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
