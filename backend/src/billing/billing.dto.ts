import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IsIsoDate } from '../common/validators/validators.js';
import { BILLING_MAX_AMOUNT } from './billing.constants.js';

/** The vendor sets or clears the debt. Amount, date and contact are optional — empty ones are not shown. */
export class UpdateBillingDto {
  @IsBoolean({ message: 'Оберіть, чи є заборгованість' })
  hasDebt: boolean;

  @IsOptional()
  @ValidateIf((o: UpdateBillingDto) => o.amount !== null)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Сума — число, до 2 знаків після коми' })
  @Min(0, { message: 'Сума не може бути від’ємною' })
  @Max(BILLING_MAX_AMOUNT, { message: 'Завелика сума' })
  amount?: number | null;

  @IsOptional()
  @IsIsoDate({ nullable: true })
  debtSince?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Не більше 300 символів' })
  paymentContact?: string;
}
