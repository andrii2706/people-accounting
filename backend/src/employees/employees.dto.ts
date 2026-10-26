import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsIsoDate, NotFuture, Rule } from '../common/validators.js';
import type { ChangeType, FamilyRelation, MaritalStatus } from '../military/dictionaries.js';
import { MAX_LENGTH, type MaxLengthField, MESSAGE, PATTERN } from '../military/employee-rules.js';

/** Необов’язковий рядок з обмеженням довжини, як у колонці БД. */
const Str = (field: MaxLengthField) =>
  applyDecorators(IsOptional(), IsString({ message: 'Очікується текст' }), MaxLength(MAX_LENGTH[field], { message: MESSAGE.tooLong(MAX_LENGTH[field]) }));
const DateField = () => applyDecorators(IsOptional(), IsIsoDate({ nullable: true }));
const PastDate = () => applyDecorators(DateField(), NotFuture());
const Pattern = (re: RegExp, message: string) => Rule((v: string) => re.test(v), message);

const MARITAL: MaritalStatus[] = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'];
const RELATIONS: FamilyRelation[] = ['HUSBAND', 'WIFE', 'SON', 'DAUGHTER'];

const passportType = (dto: Record<string, unknown>) => (dto.passportType as string | undefined) ?? 'ID_CARD';
const rankOf = (dto: Record<string, unknown>) => dto.rankCode as number | null | undefined;

export class FamilyMemberDto {
  @IsIn(RELATIONS, { message: 'Невідомий ступінь спорідненості' }) relation: FamilyRelation;
  @IsString() @IsNotEmpty({ message: 'Вкажіть прізвище' }) @MaxLength(100, { message: MESSAGE.tooLong(100) }) @Pattern(PATTERN.name, MESSAGE.name)
  lastName: string;
  @IsString() @IsNotEmpty({ message: 'Вкажіть ім’я' }) @MaxLength(100, { message: MESSAGE.tooLong(100) }) @Pattern(PATTERN.name, MESSAGE.name)
  firstName: string;
  @IsOptional() @IsString() @MaxLength(100, { message: MESSAGE.tooLong(100) }) @Pattern(PATTERN.name, MESSAGE.name)
  middleName?: string;
  @PastDate() birthDate?: string | null;
}

/** Мета-дані змін для повідомлення ТЦК: з якої дати і на якій підставі. */
export class ChangeMetaDto {
  @IsOptional() @IsIsoDate() effectiveDate?: string;
  @Str('changeBasis') basis?: string;
}

export class CreateEmployeeDto {
  @Str('personnelNumber') personnelNumber?: string;
  @IsIn(['M', 'F'], { message: 'Стать: M або F' }) gender: 'M' | 'F';

  @IsString() @IsNotEmpty({ message: 'Вкажіть прізвище' }) @MaxLength(MAX_LENGTH.lastName, { message: MESSAGE.tooLong(MAX_LENGTH.lastName) })
  @Pattern(PATTERN.name, MESSAGE.name)
  lastName: string;

  @IsString() @IsNotEmpty({ message: 'Вкажіть ім’я' }) @MaxLength(MAX_LENGTH.firstName, { message: MESSAGE.tooLong(MAX_LENGTH.firstName) })
  @Pattern(PATTERN.name, MESSAGE.name)
  firstName: string;

  @Str('middleName') @Pattern(PATTERN.name, MESSAGE.name) middleName?: string;
  @Str('rnokpp') @Pattern(PATTERN.rnokpp, MESSAGE.rnokpp) rnokpp?: string;
  @PastDate() birthDate?: string | null;
  @Str('phone') @Pattern(PATTERN.phone, MESSAGE.phone) phone?: string;
  @Str('email') @Pattern(PATTERN.email, MESSAGE.email) email?: string;
  @Str('registeredAddress') registeredAddress?: string;
  @Str('actualAddress') actualAddress?: string;

  // ---- паспорт: формат залежить від типу
  @IsOptional() @IsIn(['ID_CARD', 'BOOK'], { message: 'Тип паспорта: ID_CARD або BOOK' }) passportType?: 'ID_CARD' | 'BOOK';
  @Str('passportSeries')
  @Rule((_v: string, dto) => passportType(dto) === 'BOOK', 'У ID-картки серії немає')
  @Rule((v: string, dto) => passportType(dto) !== 'BOOK' || PATTERN.passportBookSeries.test(v), MESSAGE.passportBookSeries)
  passportSeries?: string;
  @Str('passportNumber')
  @Rule((v: string, dto) => passportType(dto) !== 'ID_CARD' || PATTERN.idCardNumber.test(v), MESSAGE.idCardNumber)
  @Rule((v: string, dto) => passportType(dto) !== 'BOOK' || PATTERN.passportBookNumber.test(v), MESSAGE.passportBookNumber)
  passportNumber?: string;
  @Str('passportIssuedBy')
  @Rule((v: string, dto) => passportType(dto) !== 'ID_CARD' || PATTERN.idCardIssuer.test(v), MESSAGE.idCardIssuer)
  passportIssuedBy?: string;
  @PastDate() passportIssuedAt?: string | null;

  @Str('foreignPassportSeries') @Pattern(PATTERN.foreignSeries, MESSAGE.foreignSeries) foreignPassportSeries?: string;
  @Str('foreignPassportNumber') @Pattern(PATTERN.foreignNumber, MESSAGE.foreignNumber) foreignPassportNumber?: string;
  @Str('foreignPassportIssuedBy') foreignPassportIssuedBy?: string;
  @PastDate() foreignPassportIssuedAt?: string | null;
  @DateField()
  @Rule((v: string, dto) => !dto.foreignPassportIssuedAt || v > (dto.foreignPassportIssuedAt as string), 'Має бути пізніше дати видачі')
  foreignPassportValidUntil?: string | null;

  @Str('educationLevel') educationLevel?: string;
  @Str('educationSpecialty') educationSpecialty?: string;
  @Str('educationDocument') educationDocument?: string;
  @PastDate() educationDocumentDate?: string | null;

  @ApiPropertyOptional({ enum: MARITAL, nullable: true })
  @IsOptional() @ValidateIf((o: CreateEmployeeDto) => o.maritalStatus !== null) @IsIn(MARITAL, { message: 'Невідомий сімейний стан' })
  maritalStatus?: MaritalStatus | null;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => FamilyMemberDto)
  @Rule((v: FamilyMemberDto[]) => v.filter((m) => m.relation === 'WIFE' || m.relation === 'HUSBAND').length <= 1, 'Чоловік/дружина може бути лише один')
  familyMembers?: FamilyMemberDto[];

  @Str('position') position?: string;
  @Str('department') department?: string;
  @Str('positionOrder') positionOrder?: string;
  @DateField()
  @Rule((v: string, dto) => !dto.hireDate || v >= (dto.hireDate as string), 'Раніше за дату прийняття')
  positionSince?: string | null;
  @DateField() hireDate?: string | null;
  @Str('hireOrderNumber') hireOrderNumber?: string;
  @DateField() hireOrderDate?: string | null;

  @IsOptional() @IsBoolean() militaryRegistered?: boolean;
  @Str('registryNumber') @Pattern(PATTERN.registryNumber, MESSAGE.registryNumber) registryNumber?: string;

  @IsOptional() @ValidateIf((o: CreateEmployeeDto) => o.rankCode !== null)
  @IsInt({ message: 'Невідоме звання' }) @Min(0, { message: 'Невідоме звання' }) @Max(22, { message: 'Невідоме звання' })
  rankCode?: number | null;

  @IsOptional() @IsBoolean() navy?: boolean;
  @Str('vos')
  @Rule((v: string, dto) => { const r = rankOf(dto); return r === null || r === undefined || r < 12 || PATTERN.vosOfficer.test(v); }, MESSAGE.vosOfficer)
  @Rule((v: string, dto) => { const r = rankOf(dto); return r === null || r === undefined || r === 0 || r >= 12 || PATTERN.vosOther.test(v); }, MESSAGE.vosOther)
  vos?: string;
  @Str('trainingProfile') trainingProfile?: string;
  @Str('accountingCategory') @Pattern(PATTERN.accountingCategory, MESSAGE.accountingCategory) accountingCategory?: string;
  @Str('militaryDocType') militaryDocType?: string;
  @Str('militaryDocSeries') @Pattern(PATTERN.militaryDocSeries, MESSAGE.militaryDocSeries) militaryDocSeries?: string;
  @Str('militaryDocNumber') @Pattern(PATTERN.militaryDocNumber, MESSAGE.militaryDocNumber) militaryDocNumber?: string;
  @Str('militaryDocIssuedBy') militaryDocIssuedBy?: string;
  @PastDate() militaryDocIssuedAt?: string | null;
  @Str('militaryDocGeneratedAt') @Pattern(PATTERN.militaryDocGeneratedAt, MESSAGE.militaryDocGeneratedAt) militaryDocGeneratedAt?: string;

  @IsOptional() @ValidateIf((o: CreateEmployeeDto) => o.tckId !== null) @IsUUID('all', { message: 'Невідомий ТЦК' })
  tckId?: string | null;

  @PastDate() tckRegisteredAt?: string | null;
  @Str('fitness') fitness?: string;
  @Str('fitnessBasis') fitnessBasis?: string;
  @PastDate() fitnessDate?: string | null;
  @Str('reservationBasis') reservationBasis?: string;
  @Str('specialAccountingCertificate') specialAccountingCertificate?: string;
  @DateField()
  reservationUntil?: string | null;
  @Str('deferralConscriptionBasis') deferralConscriptionBasis?: string;
  @Str('deferralMobilizationBasis') deferralMobilizationBasis?: string;
  @DateField() deferralUntil?: string | null;
  @Str('reserveTeamNumber') reserveTeamNumber?: string;
  @PastDate() mobilizationOrderDate?: string | null;
  @Str('militaryServiceInfo') militaryServiceInfo?: string;
  @PastDate() mobilizedAt?: string | null;
  @Str('mobilizationReleaseOrder') mobilizationReleaseOrder?: string;
  @PastDate()
  @Rule((v: string, dto) => !dto.mobilizedAt || v >= (dto.mobilizedAt as string), 'Раніше за дату мобілізації')
  demobilizedAt?: string | null;
  @Str('readmissionOrder') readmissionOrder?: string;
  @Str('notes') notes?: string;

  @IsOptional() @ValidateNested() @Type(() => ChangeMetaDto)
  changeMeta?: ChangeMetaDto;
}

export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['gender'] as const)) {
  @IsOptional() @IsIn(['M', 'F'], { message: 'Стать: M або F' }) gender?: 'M' | 'F';
}

export class DismissEmployeeDto {
  @IsIsoDate() dismissalDate: string;
  @IsOptional() @IsString() @MaxLength(50, { message: MESSAGE.tooLong(50) }) dismissalOrderNumber?: string;
  @DateField() dismissalOrderDate?: string | null;
  @Str('changeBasis') basis?: string;
}

export class EmployeeQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;

  /** active — працюють на дату; dismissed — звільнені; all — усі. */
  @IsOptional() @IsIn(['active', 'dismissed', 'all']) status?: 'active' | 'dismissed' | 'all';

  @IsOptional() @IsIn(['G1', 'G1R', 'G2', 'G2R', 'G3', 'G3R', 'G4', 'G4R', 'NONE']) group?: string;
  @IsOptional() @IsIn(['LIABLE', 'RESERVIST', 'CONSCRIPT']) category?: string;
  @IsOptional() @IsUUID() tckId?: string;
  @IsOptional() @IsIn(['true', 'false']) withWarnings?: string;
  @IsOptional() @IsIsoDate() date?: string;
}

export class UpdateChangeDto {
  @IsOptional() @IsIsoDate() effectiveDate?: string;
  @Str('changeBasis') basis?: string;
  @IsOptional() @IsBoolean() skipped?: boolean;
}

export type { ChangeType };
