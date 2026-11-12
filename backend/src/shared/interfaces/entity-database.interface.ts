/** require — TLS without checking the certificate; verify-full — TLS with the certificate and the host checked. */
export type DbSslMode = 'require' | 'verify-full' | 'disable';

/** NEW — saved, not checked; OK — connected; ERROR — the last check failed. */
export type DatabaseCheckStatus = 'NEW' | 'OK' | 'ERROR';

/** What the page shows: everything except the password. */
export interface EntityDatabaseView {
  configured: boolean;
  host: string;
  port: number;
  database: string;
  username: string;
  hasPassword: boolean;
  sslMode: DbSslMode;
  status: DatabaseCheckStatus;
  lastCheckedAt: string | null;
  lastError: string;
  serverVersion: string;
  canCreate: boolean;
  /** Plain text is allowed only in development. */
  allowPlainText: boolean;
}

/** The result of «Перевірити підключення». */
export interface DatabaseCheckResult {
  ok: boolean;
  message: string;
  serverVersion: string;
  canCreate: boolean;
}
