import { Equals, IsBase64, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MAX_SIGNATURE_BASE64 } from '../signatures/signatures.constants.js';

/** Step 1: the code of the legal entity and the work e-mail of its head. */
export class SignupStatementDto {
  @IsString() @Matches(/^\d{8}$/, { message: 'Код ЄДРПОУ юридичної особи — 8 цифр' }) edrpou: string;

  @IsEmail({}, { message: 'Вкажіть email у форматі name@company.ua' }) @MaxLength(200) email: string;

  @Equals(true, { message: 'Потрібна згода на обробку персональних даних' }) consent: boolean;

  /** Hidden from people: a bot that fills it gets a statement that is never approved. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

/** Step 2: the detached KEP signature (.p7s) of the statement, base64. */
export class SignupSignDto {
  @IsString()
  @IsNotEmpty({ message: 'Додайте файл підпису' })
  @IsBase64({}, { message: 'Файл підпису пошкоджено' })
  @MaxLength(MAX_SIGNATURE_BASE64, { message: 'Завеликий файл підпису' })
  signature: string;
}
