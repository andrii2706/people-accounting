import type { IsoDate } from './common.interface.js';
import type { WarningLevel } from './employee.interface.js';

/** Deadlines (deferral, reservation, ВЛК), TCK notices, card data (age, TCK, documents…). */
export type InboxKind = 'DEADLINE' | 'TCK' | 'CARD';

/** One in-app notification about an employee. Computed from the data; only the «read» mark is stored. */
export interface InboxItem {
  /** Stable key: the same situation keeps the key, a new date or a new change gives a new one. */
  key: string;
  kind: InboxKind;
  level: WarningLevel;
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
  date: IsoDate;
}

/** A notification already sent (to send each reminder once). */
export interface NotificationRef {
  refId: string;
  refDate: string;
}
