/** What the security journal records. */
export type SecurityEventKind =
  /** Wrong passwords in a row — the account is locked for a while. */
  | 'LOGIN_LOCKED'
  /** Many failed sign-ins from one address into different accounts — password guessing. */
  | 'LOGIN_BURST'
  /** A sign-in from a browser the account has not used before. */
  | 'NEW_DEVICE'
  /** The right password, then wrong codes from the app — somebody knows the password. */
  | 'MFA_LOCKED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  /** The administrator turned the code off — the person sets it up again at the next sign-in. */
  | 'MFA_RESET'
  /** A recovery code was used instead of the app. */
  | 'MFA_RECOVERY_USED'
  | 'MFA_CODES_RENEWED'
  /** The download limit per hour / day is reached. */
  | 'EXPORT_LIMIT'
  /** Unusually many employee cards opened in an hour. */
  | 'MASS_VIEW'
  /** A file with a script, macro or program was not accepted. */
  | 'UPLOAD_BLOCKED'
  /** The 1C key came from an address that is not allowed or after its end. */
  | 'HR_PUSH_DENIED';

export type SecurityLevel = 'INFO' | 'WARN' | 'CRITICAL';

/** How an event is reported. */
export interface SecurityPolicy {
  level: SecurityLevel;
  /** A letter to the person whose account it is. */
  toUser: boolean;
  /** A letter to the administrators / director of the legal entity and the main administrators. */
  toManagers: boolean;
  /** No second letter about the same (kind + account / address) within so many minutes. */
  quietMinutes: number;
  /** Within that time the same thing again is counted in the first row instead of a new one. */
  merge: boolean;
}

/** Who and from where — taken from the request. */
export interface SecurityActor {
  userId?: string | null;
  userName?: string;
  email?: string;
  legalEntityId?: string | null;
  ip?: string;
  userAgent?: string;
}

/** A journal row as the settings page shows it. */
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

/** A downloaded file found by its hash. */
export interface ExportTrace {
  userId: string;
  userName: string;
  fileName: string;
  ip: string;
  createdAt: string;
}

/** How a file was found to be unsafe. */
export interface UnsafeFileVerdict {
  /** Short machine reason: MACRO, SCRIPT, EXECUTABLE, TYPE_MISMATCH … */
  reason: string;
  /** For the person: what is wrong and what to do. */
  message: string;
}

/** What an upload is expected to be. */
export type UploadKind = 'table' | 'docx' | 'signature';
