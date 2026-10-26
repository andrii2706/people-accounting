export type UserRole = 'ADMIN' | 'HR';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** Тимчасовий пароль від адміністратора — потрібно змінити перед роботою. */
  mustChangePassword: boolean;
}

/** Обліковий запис у списку користувачів (адміністрування). */
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
