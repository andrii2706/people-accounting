import type { Warning } from './common.interface';
import type { DutyCategory, ListGroup } from './dictionary.interface';
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

/** One record of the personal military registration lists (Annex 5): 18 cells, columns 1–18. */
export interface ListRow {
  employeeId: string;
  group: ListGroup;
  category: DutyCategory | null;
  cells: string[];
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
