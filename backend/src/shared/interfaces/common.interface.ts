/** Dates in the API are stored as ISO strings `YYYY-MM-DD` — without time zones. */
export type IsoDate = string;

export interface FieldError {
  /** Field path: "passportSeries", "familyMembers.0.lastName", "changeMeta.basis". */
  field: string;
  message: string;
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
