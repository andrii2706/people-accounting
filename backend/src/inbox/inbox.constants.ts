import type { InboxKind } from '../shared/interfaces/inbox.interface.js';
import type { WarningLevel } from '../shared/interfaces/employee.interface.js';

/** Warnings about terms; the rest of the card warnings are «card data». */
export const INBOX_DEADLINE_CODES = new Set([
  'RESERVATION_EXPIRED',
  'RESERVATION_EXPIRING',
  'DEFERRAL_EXPIRED',
  'DEFERRAL_EXPIRING',
  'VLK_OVERDUE',
  'VLK_SOON',
]);

export const INBOX_LEVEL_ORDER: Record<WarningLevel, number> = { danger: 0, warning: 1, info: 2 };

export const INBOX_KIND_ORDER: Record<InboxKind, number> = { DEADLINE: 0, TCK: 1, CARD: 2 };
