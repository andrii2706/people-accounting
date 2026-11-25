import type { Gender, Warning } from './common.interface';
import type {
  ChangeType,
  DutyCategory,
  FamilyRelation,
  ListGroup,
  MaritalStatus,
  Tck,
} from './dictionary.interface';
import type { LetterRef } from './letter.interface';
import type { MAX_LENGTH } from '../validators/employee-rules';

export interface EmployeeDerived {
  fullName: string;
  age: number | null;
  rankTitle: string;
  compositionLabel: string;
  dutyCategory: DutyCategory | null;
  listGroup: ListGroup | null;
  employed: boolean;
  onLists: boolean;
  mobilized: boolean;
  reserved: boolean;
  warnings: Warning[];
}

/** A warning in the employee list: what and how serious; the text is in the card. */
export type WarningSummary = Pick<Warning, 'code' | 'level'>;

export interface EmployeeListItem extends Omit<EmployeeDerived, 'warnings'> {
  /** Warnings and errors (not info), without texts. */
  warnings: WarningSummary[];
  id: string;
  personnelNumber: string;
  gender: Gender;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string | null;
  position: string;
  department: string;
  hireDate: string | null;
  dismissalDate: string | null;
  rankCode: number | null;
  vos: string;
  tckName: string;
  legalEntityId: string | null;
  /** Short name of the legal entity (employer). */
  legalEntityName: string;
  reservationUntil: string | null;
  /** Deferral in force on the date (not for reserved employees). */
  deferral: boolean;
  deferralUntil: string | null;
  pendingChanges: number;
  dismissalOrderDocName: string;
  dismissalOrderNumber: string;
  dismissalOrderDate: string | null;
  /** Only for the dismissed: the notice about the dismissal. */
  dismissalNotice: DismissalNotice | null;
}

/** The notice to the TCK about a dismissal: sent / in a letter not sent yet / waiting (until) / not needed. */
export interface DismissalNotice {
  status: 'SENT' | 'IN_LETTER' | 'PENDING' | 'NONE';
  letterNumber: string | null;
  deadline: string | null;
}

export interface EmployeeList {
  date: string;
  total: number;
  items: EmployeeListItem[];
}

export interface FamilyMember {
  id?: string;
  relation: FamilyRelation;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string | null;
}

export interface MilitaryDocument {
  id?: string;
  type: string;
  series: string;
  number: string;
  issuedBy: string;
  issuedAt: string | null;
  /** Electronic document: date and time of generation — separate fields. */
  generatedDate: string | null;
  generatedTime: string;
}

export interface EmployeeEducation {
  id?: string;
  level: string;
  institution: string;
  specialty: string;
  document: string;
  documentDate: string | null;
}

export interface EmployeePosition {
  id?: string;
  position: string;
  department: string;
  since: string | null;
  orderDocName: string;
  orderNumber: string;
  orderDate: string | null;
}

export interface Employee {
  id: string;
  personnelNumber: string;
  gender: Gender;
  lastName: string;
  firstName: string;
  middleName: string;
  rnokpp: string;
  birthDate: string | null;
  phone: string;
  email: string;
  registeredAddress: string;
  actualAddress: string;
  passportType: 'ID_CARD' | 'BOOK';
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedAt: string | null;
  foreignPassportSeries: string;
  foreignPassportNumber: string;
  foreignPassportIssuedBy: string;
  foreignPassportIssuedAt: string | null;
  foreignPassportValidUntil: string | null;
  educationLevel: string;
  educationSpecialty: string;
  educationDocument: string;
  educationDocumentDate: string | null;
  educations?: EmployeeEducation[];
  maritalStatus: MaritalStatus | null;
  familyMembers: FamilyMember[];
  position: string;
  department: string;
  positionOrder: string;
  positionSince: string | null;
  positions: EmployeePosition[];
  hireDate: string | null;
  hireOrderDocName: string;
  hireOrderNumber: string;
  hireOrderDate: string | null;
  dismissalDate: string | null;
  dismissalOrderDocName: string;
  dismissalOrderNumber: string;
  dismissalOrderDate: string | null;
  militaryRegistered: boolean;
  registryNumber: string;
  rankCode: number | null;
  navy: boolean;
  vos: string;
  trainingProfile: string;
  accountingCategory: string;
  militaryDocuments: MilitaryDocument[];
  servedInArmy: boolean;
  tckId: string | null;
  tck: Tck | null;
  legalEntityId: string | null;
  tckRegisteredAt: string | null;
  fitness: string;
  fitnessBasis: string;
  fitnessDate: string | null;
  nextVlkDate: string | null;
  reserved: boolean;
  reservationBasis: string;
  specialAccountingCertificate: string;
  reservationUntil: string | null;
  reservedBy: 'COMPANY' | 'OTHER';
  reservedByName: string;
  reservedByEdrpou: string;
  deferralConscriptionBasis: string;
  deferralMobilizationBasis: string;
  deferralUntil: string | null;
  deferralUntilMobilizationEnd: boolean;
  /** Works part-time — not counted in the reservation quota (only with a deferral). */
  partTimeNotInQuota: boolean;
  reserveTeamNumber: string;
  mobilizationOrderDate: string | null;
  militaryServiceInfo: string;
  mobilizedAt: string | null;
  mobilizationReleaseOrder: string;
  demobilizedAt: string | null;
  readmissionOrder: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeChange {
  id: string;
  type: ChangeType;
  typeLabel: string;
  oldValue: string;
  newValue: string;
  effectiveDate: string;
  basis: string;
  skipped: boolean;
  deadline: string;
  overdue: boolean;
  letter: LetterRef | null;
  createdAt: string;
}

export interface PendingChange extends EmployeeChange {
  employee: {
    id: string;
    fullName: string;
    tckId: string | null;
    tckName: string;
    /** «Шевченківського РТЦК та СП» — for «Керівнику …». */
    tckNameGenitive: string;
    tckEmail: string;
    legalEntityId: string | null;
    legalEntityName: string;
  };
}

/** The fields whose changes are kept with the date they happened. */
export type HistoryField =
  'phone' | 'email' | 'registeredAddress' | 'actualAddress' | 'passport' | 'tck';

/** One change of a contact, an address, the passport or the TCK. */
export interface FieldHistoryEntry {
  id: string;
  field: HistoryField;
  oldValue: string;
  newValue: string;
  effectiveDate: string;
  oldEffectiveDate: string | null;
  basis: string;
  createdAt: string;
}

/** An employee without a TCK whose military document was issued by the chosen TCK. */
export interface TckMatch {
  id: string;
  fullName: string;
  issuedBy: string;
}

export interface EmployeeDetails extends Employee {
  derived: EmployeeDerived;
  changes: EmployeeChange[];
  fieldHistory: FieldHistoryEntry[];
}

/** History of the card in human-readable form (prepared by the server). */
export interface AuditEntry {
  id: string;
  action: string;
  actionLabel: string;
  userName: string;
  createdAt: string;
  changes: { field: string; label: string; from: string; to: string }[];
}

export type EmployeePayload = Partial<Omit<Employee, 'id' | 'tck' | 'createdAt' | 'updatedAt'>> & {
  /** notify: false — keep the change in the history, but queue no notice to the TCK. */
  changeMeta?: { effectiveDate?: string; basis?: string; notify?: boolean };
};

export type MaxLengthField = keyof typeof MAX_LENGTH;

export type EmployeeStatusFilter = 'active' | 'dismissed' | 'all';

/** Tabs of the employee list. */
export type EmployeeView = 'all' | 'attention' | 'deferral' | 'reserved' | 'dismissed';

/** Coloured status label in the employee list and the side panel. */
export interface StatusBadge {
  label: string;
  tone: 'ok' | 'warning' | 'info' | 'muted';
}

/** PATCH /api/employees/changes/:id — a queued TCK change. */
export interface EmployeeChangeUpdate {
  effectiveDate?: string;
  basis?: string;
  skipped?: boolean;
}

/** «АА 123456» split into series and number. */
export interface DocNumberParts {
  series: string;
  number: string;
}
