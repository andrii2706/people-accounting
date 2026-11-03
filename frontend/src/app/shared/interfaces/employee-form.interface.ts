import type { FamilyRelation } from './dictionary.interface';
import type { Gender } from './common.interface';

export type FormTab =
  'personal' | 'passport' | 'education' | 'family' | 'work' | 'military' | 'notes';

/**
 * Form model: all values are strings/booleans (that is how Signal Forms inputs work natively),
 * conversion to the DTO happens in formToPayload().
 */
export interface FamilyMemberForm {
  relation: FamilyRelation;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

/** One military registration document; date and time of generation are separate fields. */
export interface MilitaryDocumentForm {
  type: string;
  series: string;
  number: string;
  issuedBy: string;
  issuedAt: string;
  generatedDate: string;
  generatedTime: string;
}

export type DeferralKind = 'NONE' | 'CONSCRIPTION' | 'MOBILIZATION';

/** One education (school, college, university, second degree…). */
export interface EducationForm {
  level: string;
  institution: string;
  specialty: string;
  document: string;
  documentDate: string;
}

/** One position in the company (appointment or transfer). */
export interface PositionForm {
  position: string;
  department: string;
  since: string;
  orderDocName: string;
  orderNumber: string;
  orderDate: string;
}

export interface EmployeeFormModel {
  personnelNumber: string;
  gender: Gender;
  lastName: string;
  firstName: string;
  middleName: string;
  rnokpp: string;
  birthDate: string;
  phone: string;
  email: string;
  registeredAddress: string;
  actualAddress: string;

  passportType: 'ID_CARD' | 'BOOK';
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedAt: string;
  foreignPassportSeries: string;
  foreignPassportNumber: string;
  foreignPassportIssuedBy: string;
  foreignPassportIssuedAt: string;
  foreignPassportValidUntil: string;

  educations: EducationForm[];
  maritalStatus: string;
  familyMembers: FamilyMemberForm[];

  hireDate: string;
  hireOrderDocName: string;
  hireOrderNumber: string;
  hireOrderDate: string;
  positions: PositionForm[];
  dismissalDate: string;
  dismissalOrderDocName: string;
  dismissalOrderNumber: string;
  dismissalOrderDate: string;

  militaryRegistered: boolean;
  registryNumber: string;
  rankCode: string;
  navy: boolean;
  vos: string;
  trainingProfile: string;
  accountingCategory: string;
  servedInArmy: boolean;
  militaryDocuments: MilitaryDocumentForm[];
  tckId: string;
  tckRegisteredAt: string;
  fitness: string;
  fitnessBasis: string;
  fitnessDate: string;
  nextVlkDate: string;
  reserved: boolean;
  reservedBy: 'COMPANY' | 'OTHER';
  reservedByName: string;
  reservedByEdrpou: string;
  specialAccountingCertificate: string;
  reservationUntil: string;
  deferralConscriptionBasis: string;
  deferralMobilizationBasis: string;
  deferralUntil: string;
  deferralUntilMobilizationEnd: boolean;
  /** Form only: which deferral the person has (one of the two). */
  deferralKind: DeferralKind;
  reserveTeamNumber: string;
  mobilizationOrderDate: string;
  militaryServiceInfo: string;
  mobilizedAt: string;
  mobilizationReleaseOrder: string;
  demobilizedAt: string;
  readmissionOrder: string;
  notes: string;

  /** Grounds of the changes for the TCK notice. */
  changeEffectiveDate: string;
  changeBasis: string;
}

/** Minimal field state interface needed to navigate to errors. */
export interface FormFieldState {
  invalid: () => boolean;
  touched: () => boolean;
  errors: () => readonly { message?: string }[];
  focusBoundControl: (options?: FocusOptions) => void;
}

export type FormFieldRef = () => FormFieldState;

/** A tab of the employee form. */
export interface FormTabOption {
  id: FormTab;
  label: string;
}

/** List fields of the form (each item has its own sub-fields). */
export type FormListKey = 'familyMembers' | 'militaryDocuments' | 'positions' | 'educations';

/** Where a field lives on the form and what it is called — for error navigation. */
export interface FieldMeta {
  tab: FormTab | 'sidebar';
  label: string;
}

/** Name of a list item and its sub-fields (for the «what to fix» list). */
export interface ListItemFields {
  item: string;
  fields: string[];
}

/** Registration data whose change produces a TCK notice: label and comparison key. */
export interface ReportableField {
  label: string;
  key: (m: EmployeeFormModel) => string;
}

export interface FormErrorItem {
  key: string;
  label: string;
  message: string;
  tab: FormTab | 'sidebar';
  /** For a field inside a list (family member, document, position). */
  list?: FormListKey;
  index?: number;
}
