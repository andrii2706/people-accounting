import type { IsoDate } from './common.interface.js';
import type { MAX_LENGTH } from '../../military/employee-rules.js';
import type { Employee } from '../../employees/entities/employee.entity.js';
import type { MilitaryDocument } from '../../employees/entities/military-document.entity.js';
import type { ChangeType, DutyCategory, ListGroup } from './dictionary.interface.js';
export interface MilitaryRecord {
  /** Is on military registration (false — removed/excluded or not subject to registration). */
  militaryRegistered: boolean;
  gender: 'M' | 'F';
  birthDate: IsoDate | null;
  rankCode: number | null;
  navy: boolean;
  hireDate: IsoDate | null;
  dismissalDate: IsoDate | null;
  reserveTeamNumber: string | null;
  mobilizationOrderDate: IsoDate | null;
  reserved: boolean;
  reservationBasis: string | null;
  reservationUntil: IsoDate | null;
  /** OTHER — reserved by another legal entity: the mark is enough, the term is optional. */
  reservedBy?: 'COMPANY' | 'OTHER';
  specialAccountingCertificate: string | null;
  deferralUntil: IsoDate | null;
  mobilizedAt: IsoDate | null;
  demobilizedAt: IsoDate | null;
  registryNumber: string | null;
  tckId: string | null;
  militaryDocNumber: string | null;
  /** At least one military document is added (even without a number). */
  hasMilitaryDocument?: boolean;
  trainingProfile: string | null;
}

/** Row of the operational report (Annex 12): 1.1 / 1.2 / 1.3 / 2. */
export type OperationalRow = '1.1' | '1.2' | '1.3' | '2';

export type WarningLevel = 'danger' | 'warning' | 'info';

export interface RecordWarning {
  code: string;
  level: WarningLevel;
  message: string;
}

export type MaxLengthField = keyof typeof MAX_LENGTH;

export type EmployeeFields = Pick<Employee, keyof Employee>;

export type MilitaryDocumentFields = Pick<
  MilitaryDocument,
  'type' | 'series' | 'number' | 'issuedBy' | 'issuedAt' | 'generatedDate' | 'generatedTime'
>;

/**
 * Registration data whose change produces a TCK notice: the value as it goes into the notice,
 * compared before / after saving. All data changes of a person go into one notice.
 */
export interface ChangeRule {
  type: ChangeType;
  value: (e: Employee) => string;
  /** Do not create a change if the new value is empty (e.g. an address was cleared). */
  requireValue?: boolean;
}

export interface HistoryEntry {
  id: string;
  action: string;
  actionLabel: string;
  userName: string;
  createdAt: Date;
  changes: { field: string; label: string; from: string; to: string }[];
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
  warnings: RecordWarning[];
}
