import { applyDecorators } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import type { AccessRole } from '../shared/interfaces/legal-entity.interface.js';
import {
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
} from 'class-validator';
import { OptionalStr, PhoneField, Rule } from '../common/validators/validators.js';
import { MESSAGE, PATTERN } from '../military/employee-rules.js';
import { ACCESS_ROLES } from './legal-entities.constants.js';
import {
  ENVELOPE_FORMATS,
  LABEL_ALIGNS,
  LABEL_FONTS,
  LABEL_LAYOUTS,
  LABEL_LIMITS,
  LABEL_MODES,
} from '../documents/label-settings.constants.js';
import type {
  EnvelopeFormat,
  LabelAlign,
  LabelFont,
  LabelLayout,
  LabelMode,
  LabelSettings,
} from '../shared/interfaces/label-settings.interface.js';

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
  /** Reservation quota in percent (up to 2 decimals). null — not set. */
  @IsOptional()
  @ValidateIf((o: CreateLegalEntityDto) => o.reservationQuotaPercent !== null)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Відсоток — число, до двох знаків після коми' })
  @Min(0, { message: 'Не менше 0' })
  @Max(100, { message: 'Не більше 100' })
  reservationQuotaPercent?: number | null;
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

/** A number of millimetres / points within [min, max], at most one decimal. */
const Measure = ([min, max]: readonly [number, number], unit: string) =>
  applyDecorators(
    IsNumber({ maxDecimalPlaces: 1 }, { message: 'Число, до одного знака після коми' }),
    Min(min, { message: `Не менше ${min} ${unit}` }),
    Max(max, { message: `Не більше ${max} ${unit}` }),
  );

const TextSize = () => Measure(LABEL_LIMITS.textSize, 'пт');

/** Envelope labels of the legal entity: the whole set of settings (see LabelSettings). */
export class LabelSettingsDto implements LabelSettings {
  @IsIn(LABEL_MODES, { message: 'Наклейки на A4 або друк на конверті' }) mode: LabelMode;

  @IsIn(LABEL_FONTS, { message: `Шрифт: ${LABEL_FONTS.join(', ')}` }) font: LabelFont;
  @TextSize() titleSize: number;
  @TextSize() nameSize: number;
  @TextSize() addressSize: number;
  @TextSize() postalSize: number;
  @TextSize() phoneSize: number;
  @IsBoolean() nameBold: boolean;
  @IsBoolean() postalBold: boolean;
  @IsIn(LABEL_ALIGNS, { message: 'Ліворуч або по центру' }) align: LabelAlign;
  @IsBoolean() showTitles: boolean;
  @IsBoolean() showPhone: boolean;
  @IsBoolean() postalPrefix: boolean;

  @IsIn(LABEL_LAYOUTS, { message: 'Поруч або одне під одним' }) layout: LabelLayout;
  @IsInt({ message: 'Ціле число' })
  @Min(LABEL_LIMITS.columns[0], { message: `Не менше ${LABEL_LIMITS.columns[0]}` })
  @Max(LABEL_LIMITS.columns[1], { message: `Не більше ${LABEL_LIMITS.columns[1]}` })
  columns: number;
  @Measure(LABEL_LIMITS.labelWidthMm, 'мм') labelWidthMm: number;
  @Measure(LABEL_LIMITS.labelHeightMm, 'мм') labelHeightMm: number;
  @Measure(LABEL_LIMITS.gapMm, 'мм') gapMm: number;
  @Measure(LABEL_LIMITS.marginMm, 'мм') marginTopMm: number;
  @Measure(LABEL_LIMITS.marginMm, 'мм') marginLeftMm: number;
  @Measure(LABEL_LIMITS.paddingMm, 'мм') paddingMm: number;
  @IsBoolean() cutBorder: boolean;

  @IsIn(ENVELOPE_FORMATS, { message: `Формат: ${ENVELOPE_FORMATS.join(', ')}` }) envelope: EnvelopeFormat;
  @Measure(LABEL_LIMITS.positionMm, 'мм') senderXMm: number;
  @Measure(LABEL_LIMITS.positionMm, 'мм') senderYMm: number;
  @Measure(LABEL_LIMITS.blockWidthMm, 'мм') senderWidthMm: number;
  @Measure(LABEL_LIMITS.positionMm, 'мм') recipientXMm: number;
  @Measure(LABEL_LIMITS.positionMm, 'мм') recipientYMm: number;
  @Measure(LABEL_LIMITS.blockWidthMm, 'мм') recipientWidthMm: number;
}
