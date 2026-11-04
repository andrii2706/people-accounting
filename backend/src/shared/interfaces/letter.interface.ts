import type { IsoDate } from './common.interface.js';
import type { ListGroup } from './dictionary.interface.js';
export type LetterType = 'CHANGE_NOTICE' | 'LISTS' | 'OPERATIONAL_REPORT' | 'OTHER';

/** DRAFT — in preparation; SENT — handed over to the TCK (Ukrposhta, by hand, document management system etc.). */
export type LetterStatus = 'DRAFT' | 'SENT';

/** Number and date of a letter a document is attached to. */
export interface LetterNumberDate {
  number: string;
  date: IsoDate;
}

/** Order dates that start the notification term of a hire / dismissal. */
export interface ChangeOrderDates {
  hireOrderDate: IsoDate | null;
  dismissalOrderDate: IsoDate | null;
}

/** Aggregate rows read with getRawMany / getRawOne. */
export interface EmployeeCountRow {
  employeeId: string;
  count: number;
}

export interface MaxNumberRow {
  max: number;
}

/** Parameters a list / report letter was generated with (stored with the letter). */
export interface LetterParams {
  reportDate?: string;
  groups?: ListGroup[] | null;
  employeeIds?: string[] | null;
  /** Extract about the people registered at the letter's TCK. */
  byTck?: boolean;
}
