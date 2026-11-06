import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { passwordProblems } from '../common/utils/password-policy.utils.js';
import { Rule } from '../common/validators/validators.js';
import { MESSAGE, PATTERN } from '../military/employee-rules.js';
import type { UserRole } from '../shared/interfaces/auth.interface.js';
import { USER_ROLES } from './users.constants.js';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть email' })
  @MaxLength(200, { message: 'Не більше 200 символів' })
  @Rule((v: string) => PATTERN.email.test(v), MESSAGE.email)
  email: string;

  /** Temporary password — the user changes it on first sign-in. */
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть тимчасовий пароль' })
  @MaxLength(200, { message: 'Не більше 200 символів' })
  @Rule((v: string) => passwordProblems(v).length === 0, (v: string) => `Потрібно: ${passwordProblems(v).join(', ')}`)
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я' })
  @MaxLength(200, { message: 'Не більше 200 символів' })
  fullName: string;

  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  /** The legal entity of the account (the main administrator chooses; for the others — their own). */
  @IsOptional()
  @ValidateIf((o: CreateUserDto) => o.legalEntityId !== null)
  @IsUUID('all', { message: 'Оберіть юридичну особу' })
  legalEntityId?: string | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Не більше 200 символів' })
  fullName?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  /** Another legal entity — only the main administrator. */
  @IsOptional()
  @ValidateIf((o: UpdateUserDto) => o.legalEntityId !== null)
  @IsUUID('all', { message: 'Оберіть юридичну особу' })
  legalEntityId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Receive e-mail reminders. */
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}

export class UpdatePreferencesDto {
  @IsBoolean()
  notify: boolean;
}
