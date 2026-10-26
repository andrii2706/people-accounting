import type { ChangeType, ListGroup, Tck } from './dictionary.interface';
export type LetterType = 'CHANGE_NOTICE' | 'LISTS' | 'OPERATIONAL_REPORT' | 'OTHER';

export type LetterStatus = 'DRAFT' | 'SENT' | 'FAILED';

export interface LetterRef {
  id: string;
  number: string;
  date: string;
  status: LetterStatus;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  status: string;
  error: string;
  createdAt: string;
}

export interface Letter {
  id: string;
  year: number;
  sequence: number;
  number: string;
  date: string;
  type: LetterType;
  subject: string;
  employeeId: string | null;
  employee: { id: string; fullName: string } | null;
  tckId: string | null;
  tck: Tck | null;
  params: { reportDate?: string; groups?: ListGroup[] | null; employeeIds?: string[] | null };
  status: LetterStatus;
  recipientEmail: string;
  sentAt: string | null;
  /** Документ зафіксовано для підписання КЕП. */
  frozen: boolean;
  documentSha256: string | null;
  createdAt: string;
}

export interface LetterDetails extends Letter {
  changes: {
    id: string;
    type: ChangeType;
    newValue: string;
    effectiveDate: string;
    basis: string;
  }[];
  emails: EmailLogEntry[];
  mailConfigured: boolean;
  signatureCount: number;
}
