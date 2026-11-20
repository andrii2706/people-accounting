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

/** The second step of the sign-in: the ticket from the first answer and the code. */
export class LoginCodeDto {
  @IsString() @IsNotEmpty({ message: 'Почніть вхід ще раз' }) @MaxLength(2000) ticket: string;
  @IsString() @IsNotEmpty({ message: 'Введіть код із застосунку' }) @MaxLength(20) code: string;
}

export class LoginTicketDto {
  @IsString() @IsNotEmpty({ message: 'Почніть вхід ще раз' }) @MaxLength(2000) ticket: string;
}

/** Own account: the password once more before a new secret is made. */
export class MfaPasswordDto {
  @IsString() @IsNotEmpty({ message: 'Вкажіть пароль' }) @MaxLength(200) password: string;
}

export class MfaCodeDto {
  @IsString() @IsNotEmpty({ message: 'Введіть код із застосунку' }) @MaxLength(20) code: string;
}

/** Own account: turning the code off / new recovery codes — the password and a current code. */
export class MfaConfirmDto {
  @IsString() @IsNotEmpty({ message: 'Вкажіть пароль' }) @MaxLength(200) password: string;
  @IsString() @IsNotEmpty({ message: 'Введіть код із застосунку' }) @MaxLength(20) code: string;
}
