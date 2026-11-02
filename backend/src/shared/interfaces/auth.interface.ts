import type { User } from '../../users/user.entity.js';
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface SessionPayload {
  sub: string;
  /** Credentials version — after a password change / lockout old sessions become invalid. */
  ver: number;
  /** Session start (seconds) — for the absolute session lifetime limit. */
  sst: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export type UserRole = 'ADMIN' | 'HR';

export type CredentialsResult =
  | { status: 'ok'; user: User }
  | { status: 'invalid'; userId?: string }
  | { status: 'locked'; userId: string; lockedUntil: Date };
