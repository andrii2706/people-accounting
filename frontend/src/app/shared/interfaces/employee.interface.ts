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
  reserved: boolean;
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
    tckEmail: string;
  };
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
