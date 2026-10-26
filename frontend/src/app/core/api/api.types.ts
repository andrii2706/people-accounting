/** Типи відповідей API (дзеркало DTO бекенду). */

export type Gender = 'M' | 'F';
export type UserRole = 'ADMIN' | 'HR';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';
export type FamilyRelation = 'HUSBAND' | 'WIFE' | 'SON' | 'DAUGHTER';
export type ListGroup = 'G1' | 'G1R' | 'G2' | 'G2R' | 'G3' | 'G3R' | 'G4' | 'G4R';
export type DutyCategory = 'LIABLE' | 'RESERVIST' | 'CONSCRIPT';
export type ChangeType =
  | 'LAST_NAME' | 'FIRST_NAME' | 'MIDDLE_NAME' | 'POSITION' | 'REGISTERED_ADDRESS' | 'ACTUAL_ADDRESS'
  | 'PASSPORT' | 'FOREIGN_PASSPORT' | 'EDUCATION' | 'MARITAL_STATUS' | 'HIRE' | 'DISMISSAL';
export type LetterType = 'CHANGE_NOTICE' | 'LISTS' | 'OPERATIONAL_REPORT' | 'OTHER';
export type LetterStatus = 'DRAFT' | 'SENT' | 'FAILED';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface Warning {
  code: string;
  level: 'danger' | 'warning' | 'info';
  message: string;
}

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

export interface EmployeeListItem extends EmployeeDerived {
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
  reservationUntil: string | null;
  pendingChanges: number;
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

export interface Tck {
  id: string;
  name: string;
  nameGenitive: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
}

/** Повна картка працівника — поля збігаються з Employee entity. */
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
  maritalStatus: MaritalStatus | null;
  familyMembers: FamilyMember[];
  position: string;
  department: string;
  positionOrder: string;
  positionSince: string | null;
  hireDate: string | null;
  hireOrderNumber: string;
  hireOrderDate: string | null;
  dismissalDate: string | null;
  dismissalOrderNumber: string;
  dismissalOrderDate: string | null;
  militaryRegistered: boolean;
  registryNumber: string;
  rankCode: number | null;
  navy: boolean;
  vos: string;
  trainingProfile: string;
  accountingCategory: string;
  militaryDocType: string;
  militaryDocSeries: string;
  militaryDocNumber: string;
  militaryDocIssuedBy: string;
  militaryDocIssuedAt: string | null;
  militaryDocGeneratedAt: string;
  tckId: string | null;
  tck: Tck | null;
  tckRegisteredAt: string | null;
  fitness: string;
  fitnessBasis: string;
  fitnessDate: string | null;
  reservationBasis: string;
  specialAccountingCertificate: string;
  reservationUntil: string | null;
  deferralConscriptionBasis: string;
  deferralMobilizationBasis: string;
  deferralUntil: string | null;
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

export interface LetterRef {
  id: string;
  number: string;
  date: string;
  status: LetterStatus;
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
  employee: { id: string; fullName: string; tckId: string | null; tckName: string; tckEmail: string };
}

export interface EmployeeDetails extends Employee {
  derived: EmployeeDerived;
  changes: EmployeeChange[];
}

export interface AuditEntry {
  id: string;
  action: string;
  diff: Record<string, [unknown, unknown]>;
  userName: string;
  createdAt: string;
}

export type EmployeePayload = Partial<Omit<Employee, 'id' | 'tck' | 'createdAt' | 'updatedAt'>> & {
  changeMeta?: { effectiveDate?: string; basis?: string };
};

export interface Rank {
  code: number;
  army: string;
  navy: string;
  ageLimit: number;
  composition: string;
  compositionLabel: string;
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export interface Dictionaries {
  ranks: Rank[];
  educationLevels: string[];
  maritalStatuses: { value: MaritalStatus; labelM: string; labelF: string }[];
  militaryDocumentTypes: string[];
  fitnessStatuses: string[];
  familyRelations: Option<FamilyRelation>[];
  changeTypes: Option<ChangeType>[];
  listGroups: Option<ListGroup>[];
  dutyCategories: Option<DutyCategory>[];
}

export interface Organization {
  fullName: string;
  nameLocative: string;
  shortName: string;
  edrpou: string;
  address: string;
  phone: string;
  email: string;
  headPosition: string;
  headName: string;
  letterNumberPrefix: string;
  alertDays: number;
  notifyDeadlineDays: number;
}

export interface ResponsiblePerson {
  id: string;
  fullName: string;
  position: string;
  phone: string;
  orderNumber: string;
  validFrom: string;
  validTo: string | null;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  status: string;
  error: string;
  createdAt: string;
}

export interface Letter {
  id: string;
  year: number;
  sequence: number;
  number: string;
  date: string;
  type: LetterType;
  subject: string;
  employeeId: string | null;
  employee: { id: string; fullName: string } | null;
  tckId: string | null;
  tck: Tck | null;
  params: { reportDate?: string; groups?: ListGroup[] | null; employeeIds?: string[] | null };
  status: LetterStatus;
  recipientEmail: string;
  sentAt: string | null;
  createdAt: string;
}

export interface LetterDetails extends Letter {
  changes: { id: string; type: ChangeType; newValue: string; effectiveDate: string; basis: string }[];
  emails: EmailLogEntry[];
  mailConfigured: boolean;
}

export interface Dashboard {
  date: string;
  employees: { employed: number; onLists: number; mobilized: number; reserved: number };
  byGroup: Record<ListGroup, number>;
  byCategory: Record<DutyCategory, number>;
  pendingChanges: number;
  overdueChanges: number;
  attention: { id: string; fullName: string; warnings: Warning[] }[];
  organizationConfigured: boolean;
}

export interface ListsReport {
  date: string;
  groups: { group: ListGroup; title: string; rows: { employeeId: string; cells: string[] }[] }[];
}

export interface OperationalRow {
  code: string;
  title: string;
  total: number;
  mobilizationOrders: number;
  reserved: number;
  other: number;
  hiredSince2020: number;
  dismissedSince2020: number;
}

export interface OperationalReport {
  date: string;
  rows: OperationalRow[];
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
}
