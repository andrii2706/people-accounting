/** VENDOR — the system's supplier: sees only the payment page. */
/** DIRECTOR — the head: sees everything, signs documents, changes nothing. */
export type UserRole = 'ADMIN' | 'HR' | 'DIRECTOR' | 'VENDOR';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** Temporary password from an administrator — must be changed before working. */
  mustChangePassword: boolean;
}

/** Account in the user list (administration). */
export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  /** Receives e-mail reminders. */
  notify?: boolean;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}

/** GET /api/auth/session — null when not signed in. */
export interface SessionResponse {
  user: AuthUser | null;
}

/** Why and where to sign out. */
export interface LogoutOptions {
  /** «idle» — signed out after inactivity (the login page says so). */
  reason?: 'idle';
  returnUrl?: string;
}

/** POST /api/users — a new account with a temporary password. */
export interface CreateUserRequest {
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}

/** PATCH /api/users/:id */
export interface UpdateUserRequest {
  isActive?: boolean;
  role?: UserRole;
  fullName?: string;
  notify?: boolean;
}

/** POST /api/users/:id/reset-password */
export interface PasswordResetResult {
  temporaryPassword: string;
}

/** A temporary password shown once to the administrator. */
export interface IssuedPassword {
  user: string;
  password: string;
}

/** GET/PATCH /api/auth/preferences */
export interface UserPreferences {
  notify: boolean;
}
