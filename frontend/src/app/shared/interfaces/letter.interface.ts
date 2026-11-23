import type { ChangeType, ListGroup, Tck } from './dictionary.interface';
import type { PendingChange } from './employee.interface';

export type LetterType = 'CHANGE_NOTICE' | 'LISTS' | 'OPERATIONAL_REPORT' | 'OTHER';

/** DRAFT — in preparation; SENT — handed over to the TCK outside the system (Ukrposhta, by hand, document management system). */
export type LetterStatus = 'DRAFT' | 'SENT';

export interface LetterRef {
  id: string;
  number: string;
  date: string;
  status: LetterStatus;
  /** Entered by hand: sent before the system, there is no document. */
  external?: boolean;
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
  params: {
    reportDate?: string;
    groups?: ListGroup[] | null;
    employeeIds?: string[] | null;
    byTck?: boolean;
  };
  status: LetterStatus;
  /** Entered by hand: a notice sent before the system, without a document. */
  external: boolean;
  legalEntityId: string | null;
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
  letter: LetterRef;
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

export interface PendingChangesGroup {
  employeeId: string;
  fullName: string;
  tckId: string | null;
  tckName: string;
  overdue: boolean;
  changes: PendingChange[];
}

/** PATCH /api/letters/:id — editable requisites of a draft. */
export interface LetterUpdate {
  number?: string;
  date?: string;
  tckId?: string;
}

/** POST /api/letters/report — a letter with the lists, an extract or the operational report. */
export interface ReportLetterRequest {
  type: 'LISTS' | 'OPERATIONAL_REPORT';
  reportDate: string;
  groups?: ListGroup[];
  employeeIds?: string[];
  tckId?: string;
  /** Extract about the people registered at `tckId`. */
  byTck?: boolean;
  legalEntityId?: string;
  /** Formed lists («Сформувати»): the letter prints exactly them. */
  snapshotId?: string;
}

/** POST /api/letters/external-notice — a notice sent to the TCK before the system. */
export interface ExternalNoticeRequest {
  employeeId: string;
  number: string;
  date: string;
  changeType: ExternalNoticeType;
  effectiveDate?: string;
  tckId?: string;
  description?: string;
  /** Pending changes this notice reported — they leave the queue. */
  changeIds?: string[];
}

export type ExternalNoticeType = 'HIRE' | 'POSITION' | 'DISMISSAL' | 'DATA';

/** «№ і дата повідомлення до ТЦК» typed in the card form for the hiring or the dismissal. */
export interface StaffNoticeDraft {
  number: string;
  date: string;
}

/** Form of an old notice in the employee card. */
export interface ExternalNoticeForm {
  number: string;
  date: string;
  changeType: ExternalNoticeType;
  effectiveDate: string;
  tckId: string;
  description: string;
}

/** A part of the reconciliation package: the cover letter, the inventory (form 107) or both. */
export type ReconciliationPart = 'cover' | 'inventory' | 'all';

/** «№ і дата» of a notice about one queued change that was sent outside the app. */
export interface NoticeRecordForm {
  number: string;
  date: string;
}

/**
 * One line of «Повідомлення до ТЦК про прийняття, переведення, звільнення» in the employee card: the event,
 * the notices that reported it (they go into column 18 of the lists and extracts) and the queued change.
 */
export interface StaffNoticeRow {
  key: string;
  type: 'HIRE' | 'POSITION' | 'DISMISSAL';
  title: string;
  /** The date of the event (hiring, transfer, dismissal). */
  date: string | null;
  /** «наказ № 12 від 01.03.2026 · інженер». */
  detail: string;
  notices: EmployeeNotice[];
  /** The change still waiting in the queue — entering the number takes it out. */
  pendingId: string | null;
  /** Its deadline is over. */
  overdue: boolean;
}
