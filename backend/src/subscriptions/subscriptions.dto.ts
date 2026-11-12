import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBase64,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsIsoDate, OptionalStr, PhoneField, Rule } from '../common/validators/validators.js';
import type { PlanCode, SellerDetails } from '../shared/interfaces/subscription.interface.js';
import { MAX_SIGNATURE_BASE64 } from '../signatures/signatures.constants.js';
import { MAX_PRICE, PLAN_CODES } from './subscriptions.constants.js';

export class ChoosePlanDto {
  @IsIn(PLAN_CODES, { message: 'Оберіть тариф: місячний, річний або Enterprise' }) plan: PlanCode;

  /** Enterprise: what the client needs (number of legal entities, own database …). */
  @IsOptional() @IsString() @MaxLength(1000, { message: 'Не більше 1000 символів' }) note?: string;
}

/** A price in UAH or null — the plan is not offered yet. */
const Price = () =>
  applyDecorators(
    ValidateIf((_o: unknown, v: unknown) => v !== null),
    IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ціна — число, до 2 знаків після коми' }),
    Min(1, { message: 'Ціна — щонайменше 1 грн' }),
    Max(MAX_PRICE, { message: 'Завелика ціна' }),
  );

/** Requisites of the seller; IBAN and the codes are checked by their form. */
export class SellerDto implements SellerDetails {
  @IsString() @MaxLength(300, { message: 'Не більше 300 символів' }) name: string;

  @IsString()
  @Rule((v: string) => v === '' || /^\d{8}$|^\d{10}$/.test(v), 'Код ЄДРПОУ — 8 цифр (або РНОКПП ФОП — 10)')
  code: string;

  @IsString() @Rule((v: string) => v === '' || /^\d{10,12}$/.test(v), 'ІПН — 10 або 12 цифр') ipn: string;

  @IsString() @MaxLength(500, { message: 'Не більше 500 символів' }) address: string;

  @IsString()
  @Rule((v: string) => v === '' || /^UA\d{27}$/.test(v.replace(/\s/g, '')), 'IBAN — UA і 27 цифр')
  iban: string;

  @IsString() @MaxLength(300, { message: 'Не більше 300 символів' }) bank: string;
  @PhoneField() phone: string;
  @OptionalStr(200) email: string;
  /** «Платник єдиного податку 3 групи» / «Платник ПДВ» … */
  @OptionalStr(300) taxNote: string;
  @IsBoolean() vatPayer: boolean;
  @OptionalStr(200) signerName: string;
  @OptionalStr(200) signerPosition: string;
}

/** The vendor's settings: the seller, the prices, the terms. */
export class BillingSettingsDto {
  @ValidateNested() @Type(() => SellerDto) seller: SellerDto;

  @Price() monthlyPrice: number | null;
  @Price() yearlyPrice: number | null;

  @OptionalStr(1000) enterpriseText: string;
  @OptionalStr(300) serviceName: string;

  @IsString()
  @Rule((v: string) => /^[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]{0,10}$/.test(v), 'Префікс — до 10 літер або цифр')
  invoicePrefix: string;

  @IsInt({ message: 'Ціле число днів' })
  @Min(1, { message: 'Щонайменше 1 день' })
  @Max(60, { message: 'Не більше 60 днів' })
  dueDays: number;

  @IsInt({ message: 'Ціле число днів' })
  @Min(0, { message: 'Не менше 0' })
  @Max(90, { message: 'Не більше 90 днів' })
  trialDays: number;
}

export class ExtendTrialDto {
  @IsIsoDate() until: string;
}

/** An invoice the vendor issues by hand (Enterprise, or any special terms). */
export class VendorInvoiceDto {
  @IsInt({ message: 'Ціле число місяців' })
  @Min(1, { message: 'Щонайменше 1 місяць' })
  @Max(36, { message: 'Не більше 36 місяців' })
  months: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Сума — число, до 2 знаків після коми' })
  @Min(1, { message: 'Сума — щонайменше 1 грн' })
  @Max(MAX_PRICE, { message: 'Завелика сума' })
  total: number;

  /** Instead of the standard line «Послуги … тариф …, період …». */
  @OptionalStr(500) description?: string;
}

export class MarkPaidDto {
  @IsOptional() @IsIsoDate() paidAt?: string;
}

/** The head's detached KEP signature (.p7s) of the acceptance document, base64. */
export class OfferSignDto {
  @IsString()
  @IsNotEmpty({ message: 'Додайте файл підпису' })
  @IsBase64({}, { message: 'Файл підпису пошкоджено' })
  @MaxLength(MAX_SIGNATURE_BASE64, { message: 'Завеликий файл підпису' })
  signature: string;
}
