/** The security journal (Налаштування → «Безпека»). */
export type SecurityEventKind =
  | 'LOGIN_LOCKED'
  | 'LOGIN_BURST'
  | 'NEW_DEVICE'
  | 'MFA_LOCKED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_RESET'
  | 'MFA_RECOVERY_USED'
  | 'MFA_CODES_RENEWED'
  | 'EXPORT_LIMIT'
  | 'MASS_VIEW'
  | 'UPLOAD_BLOCKED'
  | 'HR_PUSH_DENIED';

export type SecurityLevel = 'INFO' | 'WARN' | 'CRITICAL';

export interface SecurityEventView {
  id: string;
  kind: SecurityEventKind;
  level: SecurityLevel;
  title: string;
  userId: string | null;
  userName: string;
  legalEntityId: string | null;
  ip: string;
  device: string;
  details: Record<string, string | number | boolean>;
  notified: boolean;
  createdAt: string;
}

export interface SecurityEventsPage {
  items: SecurityEventView[];
  total: number;
}

/** «Who downloaded this file» — found by the hash of the file. */
export interface ExportTrace {
  userId: string;
  userName: string;
  fileName: string;
  ip: string;
  createdAt: string;
}
