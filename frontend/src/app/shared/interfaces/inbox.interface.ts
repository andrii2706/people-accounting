import type { Warning } from './common.interface';

/** Deadlines (deferral, reservation, ВЛК), TCK notices, card data (age, TCK, documents…). */
export type InboxKind = 'DEADLINE' | 'TCK' | 'CARD';

/** One in-app notification about an employee. Computed from the data; only the «read» mark is stored. */
export interface InboxItem {
  /** Stable key: the same situation keeps the key, a new date or a new change gives a new one. */
  key: string;
  kind: InboxKind;
  level: Warning['level'];
  employeeId: string;
  employeeName: string;
  message: string;
  /** Where to open it: the employee card or the page of TCK notices. */
  link: 'EMPLOYEE' | 'NOTICES';
  read: boolean;
}

export interface InboxView {
  items: InboxItem[];
  unread: number;
  date: string;
}
