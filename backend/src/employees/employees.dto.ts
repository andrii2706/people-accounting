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

/** Optional string with a length limit, as in the DB column. */
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

/** One military registration document (an employee may have several). */
export class MilitaryDocumentDto {
  @IsOptional() @IsString() @MaxLength(MAX_LENGTH.docType, { message: MESSAGE.tooLong(MAX_LENGTH.docType) })
  type?: string;
  @IsOptional() @IsString() @MaxLength(MAX_LENGTH.docSeries, { message: MESSAGE.tooLong(MAX_LENGTH.docSeries) }) @Pattern(PATTERN.docSeries, MESSAGE.docSeries)
  series?: string;
  @IsOptional() @IsString() @MaxLength(MAX_LENGTH.docNumber, { message: MESSAGE.tooLong(MAX_LENGTH.docNumber) }) @Pattern(PATTERN.docNumber, MESSAGE.docNumber)
  number?: string;
  @IsOptional() @IsString() @MaxLength(MAX_LENGTH.docIssuedBy, { message: MESSAGE.tooLong(MAX_LENGTH.docIssuedBy) })
  issuedBy?: string;
  @PastDate() issuedAt?: string | null;
  /** Electronic document: date and time of generation — separate fields. */
  @PastDate() generatedDate?: string | null;
  @IsOptional() @IsString() @Pattern(PATTERN.docGeneratedTime, MESSAGE.docGeneratedTime)
  generatedTime?: string;
}

/** A position in the company (appointment or transfer). */
export class EmployeePositionDto {
  @IsString() @IsNotEmpty({ message: 'Вкажіть посаду' }) @MaxLength(MAX_LENGTH.position, { message: MESSAGE.tooLong(MAX_LENGTH.position) })
  position: string;
  @Str('department') department?: string;
  @DateField() since?: string | null;
  @Str('orderDocName') orderDocName?: string;
  @Str('orderNumber') orderNumber?: string;
  @DateField() orderDate?: string | null;
}

/** Change metadata for the TCK notice: effective date and grounds. */
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

  // ---- passport: the format depends on the type
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
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => EmployeePositionDto)
  positions?: EmployeePositionDto[];

  @DateField() hireDate?: string | null;
  @Str('hireOrderDocName') hireOrderDocName?: string;
  @Str('hireOrderNumber') hireOrderNumber?: string;
  @DateField() hireOrderDate?: string | null;

  /** Dismissal is entered in the edit form as well (a TCK notice is created). */
  @DateField()
  @Rule((v: string, dto) => !dto.hireDate || v >= (dto.hireDate as string), 'Раніше за дату прийняття')
  dismissalDate?: string | null;
  @Str('dismissalOrderDocName') dismissalOrderDocName?: string;
  @Str('dismissalOrderNumber') dismissalOrderNumber?: string;
  @DateField() dismissalOrderDate?: string | null;

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
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => MilitaryDocumentDto)
  militaryDocuments?: MilitaryDocumentDto[];

  @IsOptional() @IsBoolean() servedInArmy?: boolean;

  @IsOptional() @ValidateIf((o: CreateEmployeeDto) => o.tckId !== null) @IsUUID('all', { message: 'Невідомий ТЦК' })
  tckId?: string | null;

  @PastDate() tckRegisteredAt?: string | null;
  @Str('fitness') fitness?: string;
  @Str('fitnessBasis') fitnessBasis?: string;
  @PastDate() fitnessDate?: string | null;
  @IsOptional() @IsBoolean({ message: 'Вкажіть, чи заброньований працівник' })
  reserved?: boolean;
  @Str('reservationBasis') reservationBasis?: string;
  @Str('specialAccountingCertificate') specialAccountingCertificate?: string;
  @DateField()
  reservationUntil?: string | null;
  @IsOptional() @IsIn(['COMPANY', 'OTHER'], { message: 'Ким заброньовано: COMPANY або OTHER' })
  reservedBy?: 'COMPANY' | 'OTHER';
  @Str('reservedByName') reservedByName?: string;
  @Str('reservedByEdrpou') @Pattern(PATTERN.edrpou, MESSAGE.edrpou) reservedByEdrpou?: string;
  @Str('deferralConscriptionBasis') deferralConscriptionBasis?: string;
  @Str('deferralMobilizationBasis') deferralMobilizationBasis?: string;
  @DateField() deferralUntil?: string | null;
  /** Deferral «до завершення мобілізації» instead of a date. */
  @IsOptional() @IsBoolean() deferralUntilMobilizationEnd?: boolean;
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
  @Str('dismissalOrderDocName') dismissalOrderDocName?: string;
  @IsOptional() @IsString() @MaxLength(50, { message: MESSAGE.tooLong(50) }) dismissalOrderNumber?: string;
  @DateField() dismissalOrderDate?: string | null;
  @Str('changeBasis') basis?: string;
}

export class EmployeeQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;

  /** active — employed on the date; dismissed — dismissed; all — everyone. */
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
