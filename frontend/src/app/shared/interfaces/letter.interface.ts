import type { ChangeType, ListGroup, Tck } from './dictionary.interface';
export type LetterType = 'CHANGE_NOTICE' | 'LISTS' | 'OPERATIONAL_REPORT' | 'OTHER';

/** DRAFT — in preparation; SENT — handed over to the TCK outside the system (Ukrposhta, by hand, document management system). */
export type LetterStatus = 'DRAFT' | 'SENT';

export interface LetterRef {
  id: string;
  number: string;
  date: string;
  status: LetterStatus;
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
  sentAt: string | null;
  /** The document is frozen for qualified e-signing. */
  frozen: boolean;
  documentSha256: string | null;
  createdAt: string;
}

/** A stored notice (Annex 4) inside a letter. */
export interface LetterNotice {
  id: string;
  letterId: string;
  sequence: number;
  /** Notice number as printed: "<letter>/<n>" or the letter number when it is the only one. */
  number: string;
  employeeId: string | null;
  employeeName: string;
  changeType: ChangeType;
  typeLabel: string;
  effectiveDate: string;
  createdAt: string;
}

/** Notice with its letter — the history shown in the employee card. */
export interface EmployeeNotice extends LetterNotice {
  letter: { id: string; number: string; date: string; status: LetterStatus };
}

export interface LetterDetails extends Letter {
  notices: LetterNotice[];
  changes: {
    id: string;
    type: ChangeType;
    newValue: string;
    effectiveDate: string;
    basis: string;
  }[];
  signatureCount: number;
}
