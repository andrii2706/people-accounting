import type { IsoDate } from './common.interface.js';
import type { DutyCategory, ListGroup, ListSection } from './dictionary.interface.js';
export interface ListRowView {
  employeeId: string;
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
