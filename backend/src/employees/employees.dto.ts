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
import { IsIsoDate, Rule } from '../common/validators/validators.js';
import { MAX_LENGTH, MESSAGE, PATTERN } from '../military/employee-rules.js';
import type { MaritalStatus, FamilyRelation, ChangeType } from '../shared/interfaces/dictionary.interface.js';
import { DateField } from '../common/validators/validators.js';
import { EmployeeStr } from './utils/employee-dto.utils.js';
import { FAMILY_RELATIONS } from './employees.constants.js';
import { PastDate } from '../common/validators/validators.js';
import { Pattern } from '../common/validators/validators.js';
import { passportType } from './utils/employee-dto.utils.js';
import { rankOf } from './utils/employee-dto.utils.js';
import { MARITAL_STATUS_CODES } from './employees.constants.js';

export class FamilyMemberDto {
  @IsIn(FAMILY_RELATIONS, { message: 'Невідомий ступінь спорідненості' }) relation: FamilyRelation;
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть прізвище' })
  @MaxLength(100, { message: MESSAGE.tooLong(100) })
  @Pattern(PATTERN.name, MESSAGE.name)
  lastName: string;
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я' })
  @MaxLength(100, { message: MESSAGE.tooLong(100) })
  @Pattern(PATTERN.name, MESSAGE.name)
  firstName: string;
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: MESSAGE.tooLong(100) })
  @Pattern(PATTERN.name, MESSAGE.name)
  middleName?: string;
  @PastDate() birthDate?: string | null;
}

/** One military registration document (an employee may have several). */
export class MilitaryDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTH.docType, { message: MESSAGE.tooLong(MAX_LENGTH.docType) })
  type?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTH.docSeries, { message: MESSAGE.tooLong(MAX_LENGTH.docSeries) })
  @Pattern(PATTERN.docSeries, MESSAGE.docSeries)
  series?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTH.docNumber, { message: MESSAGE.tooLong(MAX_LENGTH.docNumber) })
  @Pattern(PATTERN.docNumber, MESSAGE.docNumber)
  number?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTH.docIssuedBy, { message: MESSAGE.tooLong(MAX_LENGTH.docIssuedBy) })
  issuedBy?: string;
  @PastDate() issuedAt?: string | null;
  /** Electronic document: date and time of generation — separate fields. */
  @PastDate() generatedDate?: string | null;
  @IsOptional()
  @IsString()
  @Pattern(PATTERN.docGeneratedTime, MESSAGE.docGeneratedTime)
  generatedTime?: string;
}

/** A position in the company (appointment or transfer). */
export class EmployeePositionDto {
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть посаду' })
  @MaxLength(MAX_LENGTH.position, { message: MESSAGE.tooLong(MAX_LENGTH.position) })
  position: string;
  @EmployeeStr('department') department?: string;
  @DateField() since?: string | null;
  @EmployeeStr('orderDocName') orderDocName?: string;
  @EmployeeStr('orderNumber') orderNumber?: string;
  @DateField() orderDate?: string | null;
}

export class EmployeeEducationDto {
  @EmployeeStr('educationLevel') level?: string;
  @EmployeeStr('educationInstitution') institution?: string;
  @EmployeeStr('educationSpecialty') specialty?: string;
  @EmployeeStr('educationDocument') document?: string;
  @PastDate() documentDate?: string | null;
}

/** Change metadata for the TCK notice: effective date and grounds. */
export class ChangeMetaDto {
  @IsOptional() @IsIsoDate() effectiveDate?: string;
  @EmployeeStr('changeBasis') basis?: string;
}

export class CreateEmployeeDto {
  @EmployeeStr('personnelNumber') personnelNumber?: string;
  @IsIn(['M', 'F'], { message: 'Стать: M або F' }) gender: 'M' | 'F';

  @IsString()
  @IsNotEmpty({ message: 'Вкажіть прізвище' })
  @MaxLength(MAX_LENGTH.lastName, { message: MESSAGE.tooLong(MAX_LENGTH.lastName) })
  @Pattern(PATTERN.name, MESSAGE.name)
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я' })
  @MaxLength(MAX_LENGTH.firstName, { message: MESSAGE.tooLong(MAX_LENGTH.firstName) })
  @Pattern(PATTERN.name, MESSAGE.name)
  firstName: string;

  @EmployeeStr('middleName') @Pattern(PATTERN.name, MESSAGE.name) middleName?: string;
  @EmployeeStr('rnokpp') @Pattern(PATTERN.rnokpp, MESSAGE.rnokpp) rnokpp?: string;
  @PastDate() birthDate?: string | null;
  @EmployeeStr('phone') @Pattern(PATTERN.phone, MESSAGE.phone) phone?: string;
  @EmployeeStr('email') @Pattern(PATTERN.email, MESSAGE.email) email?: string;
  @EmployeeStr('registeredAddress') registeredAddress?: string;
  @EmployeeStr('actualAddress') actualAddress?: string;

  // passport: the format depends on the type
  @IsOptional() @IsIn(['ID_CARD', 'BOOK'], { message: 'Тип паспорта: ID_CARD або BOOK' }) passportType?:
    'ID_CARD' | 'BOOK';
  @EmployeeStr('passportSeries')
  @Rule((_v: string, dto) => passportType(dto) === 'BOOK', 'У ID-картки серії немає')
  @Rule(
    (v: string, dto) => passportType(dto) !== 'BOOK' || PATTERN.passportBookSeries.test(v),
    MESSAGE.passportBookSeries,
  )
  passportSeries?: string;
  @EmployeeStr('passportNumber')
  @Rule((v: string, dto) => passportType(dto) !== 'ID_CARD' || PATTERN.idCardNumber.test(v), MESSAGE.idCardNumber)
  @Rule(
    (v: string, dto) => passportType(dto) !== 'BOOK' || PATTERN.passportBookNumber.test(v),
    MESSAGE.passportBookNumber,
  )
  passportNumber?: string;
  @EmployeeStr('passportIssuedBy')
  @Rule((v: string, dto) => passportType(dto) !== 'ID_CARD' || PATTERN.idCardIssuer.test(v), MESSAGE.idCardIssuer)
  passportIssuedBy?: string;
  @PastDate() passportIssuedAt?: string | null;

  @EmployeeStr('foreignPassportSeries')
  @Pattern(PATTERN.foreignSeries, MESSAGE.foreignSeries)
  foreignPassportSeries?: string;
  @EmployeeStr('foreignPassportNumber')
  @Pattern(PATTERN.foreignNumber, MESSAGE.foreignNumber)
  foreignPassportNumber?: string;
  @EmployeeStr('foreignPassportIssuedBy') foreignPassportIssuedBy?: string;
  @PastDate() foreignPassportIssuedAt?: string | null;
  @DateField()
  @Rule(
    (v: string, dto) => !dto.foreignPassportIssuedAt || v > (dto.foreignPassportIssuedAt as string),
    'Має бути пізніше дати видачі',
  )
  foreignPassportValidUntil?: string | null;

  @EmployeeStr('educationLevel') educationLevel?: string;
  @EmployeeStr('educationSpecialty') educationSpecialty?: string;
  @EmployeeStr('educationDocument') educationDocument?: string;
  @PastDate() educationDocumentDate?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EmployeeEducationDto)
  educations?: EmployeeEducationDto[];

  @ApiPropertyOptional({ enum: MARITAL_STATUS_CODES, nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateEmployeeDto) => o.maritalStatus !== null)
  @IsIn(MARITAL_STATUS_CODES, { message: 'Невідомий сімейний стан' })
  maritalStatus?: MaritalStatus | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberDto)
  @Rule(
    (v: FamilyMemberDto[]) => v.filter((m) => m.relation === 'WIFE' || m.relation === 'HUSBAND').length <= 1,
    'Чоловік/дружина може бути лише один',
  )
  familyMembers?: FamilyMemberDto[];

  @EmployeeStr('position') position?: string;
  @EmployeeStr('department') department?: string;
  @EmployeeStr('positionOrder') positionOrder?: string;
  @DateField()
  @Rule((v: string, dto) => !dto.hireDate || v >= (dto.hireDate as string), 'Раніше за дату прийняття')
  positionSince?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EmployeePositionDto)
  positions?: EmployeePositionDto[];

  @DateField() hireDate?: string | null;
  @EmployeeStr('hireOrderDocName') hireOrderDocName?: string;
  @EmployeeStr('hireOrderNumber') hireOrderNumber?: string;
  @DateField() hireOrderDate?: string | null;

  /** Dismissal is entered in the edit form as well (a TCK notice is created). */
  @DateField()
  @Rule((v: string, dto) => !dto.hireDate || v >= (dto.hireDate as string), 'Раніше за дату прийняття')
  dismissalDate?: string | null;
  @EmployeeStr('dismissalOrderDocName') dismissalOrderDocName?: string;
  @EmployeeStr('dismissalOrderNumber') dismissalOrderNumber?: string;
  @DateField() dismissalOrderDate?: string | null;

  @IsOptional() @IsBoolean() militaryRegistered?: boolean;
  @EmployeeStr('registryNumber') @Pattern(PATTERN.registryNumber, MESSAGE.registryNumber) registryNumber?: string;

  @IsOptional()
  @ValidateIf((o: CreateEmployeeDto) => o.rankCode !== null)
  @IsInt({ message: 'Невідоме звання' })
  @Min(0, { message: 'Невідоме звання' })
  @Max(22, { message: 'Невідоме звання' })
  rankCode?: number | null;

  @IsOptional() @IsBoolean() navy?: boolean;
  @EmployeeStr('vos')
  @Rule((v: string, dto) => {
    const r = rankOf(dto);
    return r === null || r === undefined || r < 12 || PATTERN.vosOfficer.test(v);
  }, MESSAGE.vosOfficer)
  @Rule((v: string, dto) => {
    const r = rankOf(dto);
    return r === null || r === undefined || r === 0 || r >= 12 || PATTERN.vosOther.test(v);
  }, MESSAGE.vosOther)
  vos?: string;
  @EmployeeStr('trainingProfile') trainingProfile?: string;
  @EmployeeStr('accountingCategory')
  @Pattern(PATTERN.accountingCategory, MESSAGE.accountingCategory)
  accountingCategory?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MilitaryDocumentDto)
  militaryDocuments?: MilitaryDocumentDto[];

  @IsOptional() @IsBoolean() servedInArmy?: boolean;

  @IsOptional()
  @ValidateIf((o: CreateEmployeeDto) => o.tckId !== null)
  @IsUUID('all', { message: 'Невідомий ТЦК' })
  tckId?: string | null;

  @PastDate() tckRegisteredAt?: string | null;
  @EmployeeStr('fitness') fitness?: string;
  @EmployeeStr('fitnessBasis') fitnessBasis?: string;
  @PastDate() fitnessDate?: string | null;
  @DateField()
  @Rule(
    (v: string | null, dto) => !v || !dto.fitnessDate || v > dto.fitnessDate,
    'Наступна ВЛК має бути пізніше за дату проходження',
  )
  nextVlkDate?: string | null;
  @IsOptional()
  @IsBoolean({ message: 'Вкажіть, чи заброньований працівник' })
  reserved?: boolean;
  @EmployeeStr('reservationBasis') reservationBasis?: string;
  @EmployeeStr('specialAccountingCertificate') specialAccountingCertificate?: string;
  @DateField()
  reservationUntil?: string | null;
  @IsOptional()
  @IsIn(['COMPANY', 'OTHER'], { message: 'Ким заброньовано: COMPANY або OTHER' })
  reservedBy?: 'COMPANY' | 'OTHER';
  @EmployeeStr('reservedByName') reservedByName?: string;
  @EmployeeStr('reservedByEdrpou') @Pattern(PATTERN.edrpou, MESSAGE.edrpou) reservedByEdrpou?: string;
  @EmployeeStr('deferralConscriptionBasis') deferralConscriptionBasis?: string;
  @EmployeeStr('deferralMobilizationBasis') deferralMobilizationBasis?: string;
  @DateField() deferralUntil?: string | null;
  /** Deferral «до завершення мобілізації» instead of a date. */
  @IsOptional() @IsBoolean() deferralUntilMobilizationEnd?: boolean;
  @EmployeeStr('reserveTeamNumber') reserveTeamNumber?: string;
  @PastDate() mobilizationOrderDate?: string | null;
  @EmployeeStr('militaryServiceInfo') militaryServiceInfo?: string;
  @PastDate() mobilizedAt?: string | null;
  @EmployeeStr('mobilizationReleaseOrder') mobilizationReleaseOrder?: string;
  @PastDate()
  @Rule((v: string, dto) => !dto.mobilizedAt || v >= (dto.mobilizedAt as string), 'Раніше за дату мобілізації')
  demobilizedAt?: string | null;
  @EmployeeStr('readmissionOrder') readmissionOrder?: string;
  @EmployeeStr('notes') notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChangeMetaDto)
  changeMeta?: ChangeMetaDto;
}

export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['gender'] as const)) {
  @IsOptional() @IsIn(['M', 'F'], { message: 'Стать: M або F' }) gender?: 'M' | 'F';
}

export class DismissEmployeeDto {
  @IsIsoDate() dismissalDate: string;
  @EmployeeStr('dismissalOrderDocName') dismissalOrderDocName?: string;
  @IsOptional() @IsString() @MaxLength(50, { message: MESSAGE.tooLong(50) }) dismissalOrderNumber?: string;
  @DateField() dismissalOrderDate?: string | null;
  @EmployeeStr('changeBasis') basis?: string;
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
  @EmployeeStr('changeBasis') basis?: string;
  @IsOptional() @IsBoolean() skipped?: boolean;
}

export type { ChangeType };
