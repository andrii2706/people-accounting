import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { passwordProblems } from '../common/utils/password-policy.utils.js';
import { Rule } from '../common/validators/validators.js';

export class LoginDto {
  @IsEmail({}, { message: 'Вкажіть email у форматі name@company.ua' }) @MaxLength(200) email: string;
  @IsString() @IsNotEmpty({ message: 'Вкажіть пароль' }) @MaxLength(200) password: string;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty({ message: 'Вкажіть поточний пароль' }) @MaxLength(200) currentPassword: string;
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть новий пароль' })
  @MaxLength(200)
  @Rule((v: string) => passwordProblems(v).length === 0, (v: string) => `Потрібно: ${passwordProblems(v).join(', ')}`)
  newPassword: string;
}

/** A new password set by the link from a letter. */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Посилання неповне — відкрийте його з листа ще раз' })
  @MaxLength(100)
  token: string;
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть новий пароль' })
  @MaxLength(200)
  @Rule((v: string) => passwordProblems(v).length === 0, (v: string) => `Потрібно: ${passwordProblems(v).join(', ')}`)
  newPassword: string;
}
