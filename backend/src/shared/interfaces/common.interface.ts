/** Dates in the API are stored as ISO strings `YYYY-MM-DD` — without time zones. */
export type IsoDate = string;

export interface FieldError {
  /** Field path: "passportSeries", "familyMembers.0.lastName", "changeMeta.basis". */
  field: string;
  message: string;
  /** Human name of the field («Поштовий індекс»), set in API error responses. */
  label?: string;
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'DISMISS'
  | 'VIEW'
  | 'EXPORT'
  | 'SEND'
  | 'SIGN'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOCKED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'USER_UPDATED';

/** Postgres error details of a TypeORM QueryFailedError. */
export interface PgDriverError {
  code?: string;
  column?: string;
  detail?: string;
}

/** A Node/fetch error with a low-level cause (ECONNRESET, ENOTFOUND…). */
export interface ErrorWithCause {
  cause?: { code?: string };
}

/** Options of the @IsIsoDate() decorator. */
export interface IsoDateOptions {
  /** Empty string / null are allowed. */
  nullable?: boolean;
}

/** A generated file: content and the name to download it under. */
export interface FileResult {
  buffer: Buffer;
  filename: string;
}

/** Labels of a list field for error messages: «Військово-обліковий документ 1 — Номер». */
export interface ListItemLabels {
  title: string;
  fields: Record<string, string>;
}

/** A Nest HttpException seen from outside an HTTP request (CLI jobs): its body with readable lines. */
export interface HttpErrorLike {
  response?: { message?: string | string[] };
}
