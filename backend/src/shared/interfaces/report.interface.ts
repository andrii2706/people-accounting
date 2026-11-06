import type { LetterNumberDate, LetterStatus } from './letter.interface.js';
import type { IsoDate } from './common.interface.js';
import type { DutyCategory, ListGroup, ListSection } from './dictionary.interface.js';
export interface ListRowView {
  employeeId: string;
  /** TCK where the person is registered — extracts are sent to each TCK separately. */
  tckId: string | null;
  group: ListGroup;
  section: ListSection;
  category: DutyCategory | null;
  cells: string[];
  status: ListRowStatus;
}

/** Statuses for the on-screen list (badges and filters); the document uses only the cells. */
export interface ListRowStatus {
  reserved: boolean;
  reservedByOther: boolean;
  reservedUntil: IsoDate | null;
  /** Deferral in force on the date. */
  deferral: boolean;
  deferralUntil: IsoDate | null;
  deferralUntilMobilizationEnd: boolean;
  mobilized: boolean;
  mobilizationOrder: boolean;
  /** Changes not yet reported to the TCK. */
  pendingNotices: number;
  /** Date of the latest outgoing letter to the TCK about this person. */
  lastNoticeDate: IsoDate | null;
  /** Warnings and errors (not info) from the record checks. */
  warnings: number;
  position: string;
  positionSince: IsoDate | null;
}

/** Data from outside the card needed for the statuses of a list row. */
export interface ListRowStatusContext {
  mobilizationUntil: IsoDate | null;
  alertDays: number;
  pendingNotices: number;
  lastNoticeDate: IsoDate | null;
}

/** What part of the lists to take: groups, specific employees, a legal entity, a TCK. */
export interface ListsFilter {
  groups?: ListGroup[];
  onlyIds?: string[];
  legalEntityId?: string | null;
  tckId?: string | null;
}

/** Lists / extract document: the filter plus the outgoing number and date of the letter. */
export interface ListsDocxOptions extends ListsFilter {
  letter?: LetterNumberDate | null;
}

/** One TCK in the extracts overview: how many people of each list are registered there. */
export interface TckExtractSummary {
  tckId: string | null;
  tckName: string;
  sections: Record<ListSection, number>;
  total: number;
  /** The latest extract registered as a letter to this TCK: its outgoing number and date. */
  lastLetter: TckLetterRef | null;
}

/** A registered letter to a TCK, for the extracts table. */
export interface TckLetterRef extends LetterNumberDate {
  id: string;
  status: LetterStatus;
}
