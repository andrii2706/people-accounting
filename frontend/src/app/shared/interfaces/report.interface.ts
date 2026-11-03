import type { Warning } from './common.interface';
import type { DutyCategory, ListGroup, ListSection } from './dictionary.interface';

export interface Dashboard {
  date: string;
  employees: { employed: number; onLists: number; mobilized: number; reserved: number };
  byGroup: Record<ListGroup, number>;
  bySection: Record<ListSection, number>;
  byCategory: Record<DutyCategory, number>;
  /** Deferrals in force on the date. */
  deferrals: number;
  /** Reservation quota of the company and how much of it is used. */
  reservation: {
    quota: number | null;
    quotaBasis: string;
    reservedCompany: number;
    reservedOther: number;
    available: number | null;
    exceeded: boolean;
  };
  mobilizationUntil: string | null;
  pendingChanges: number;
  overdueChanges: number;
  attention: { id: string; fullName: string; warnings: Warning[] }[];
  organizationConfigured: boolean;
}

/** One record of the personal military registration lists (Annex 5): 18 cells, columns 1–18. */
export interface ListRow {
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
  reservedUntil: string | null;
  /** Deferral in force on the date. */
  deferral: boolean;
  deferralUntil: string | null;
  deferralUntilMobilizationEnd: boolean;
  mobilized: boolean;
  mobilizationOrder: boolean;
  /** Changes not yet reported to the TCK. */
  pendingNotices: number;
  /** Date of the latest outgoing letter to the TCK about this person. */
  lastNoticeDate: string | null;
  /** Warnings and errors (not info) from the record checks. */
  warnings: number;
  position: string;
  positionSince: string | null;
}

/** Quick filters of the lists page. */
export type ListQuickFilter =
  'RESERVED' | 'DEFERRAL' | 'MOBILIZATION_ORDER' | 'PENDING' | 'WARNINGS';

/** A titled block of the expanded row: column numbers of the form (1-based). */
export interface ListDetailGroup {
  title: string;
  columns: number[];
}

export interface ListsReport {
  date: string;
  rows: ListRow[];
  counts: Record<DutyCategory, number>;
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

/** One line of «Що зробити сьогодні»: several notifications can be one task (e.g. all TCK notices). */
export interface DashboardTask {
  key: string;
  level: 'danger' | 'warning';
  title: string;
  detail: string;
  action: string;
  link: string[];
  query?: Record<string, string>;
}

/** An upcoming term for «Строки найближчим часом». */
export interface UpcomingTerm {
  key: string;
  date: string;
  title: string;
  employeeName: string;
  employeeId: string;
}

/** A group of card problems on the dashboard: one task with a count. */
export interface DashboardCardGroup {
  title: (count: number) => string;
  detail: string;
}

/** A per-employee task on the dashboard. */
export interface DashboardTaskMeta {
  title: (name: string) => string;
  action: string;
  /** Opens the edit form instead of the card. */
  edit?: boolean;
}

/** Parts of an inbox key «CODE:employeeId:ref». */
export interface InboxKeyParts {
  code: string;
  ref: string;
}

/** A TCK name split for the table: «Шевченківський РТЦК та СП» + «м. Київ». */
export interface TckNameParts {
  name: string;
  place: string;
}
