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
