export type UserRole = 'ADMIN' | 'HR';

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
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}
