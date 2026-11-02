import type { DutyCategory, ListGroup, ListSection } from './dictionary.interface.js';
export interface ListRowView {
  employeeId: string;
  group: ListGroup;
  section: ListSection;
  category: DutyCategory | null;
  cells: string[];
}
