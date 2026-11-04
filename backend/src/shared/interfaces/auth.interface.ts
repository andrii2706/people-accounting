import type { Request } from 'express';

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

/** VENDOR — the system's supplier: sees only the payment page, no personal data. */
/** DIRECTOR — the head: sees everything, signs documents, changes nothing. */
export type UserRole = 'ADMIN' | 'HR' | 'DIRECTOR' | 'VENDOR';

export type CredentialsResult =
  | { status: 'ok'; user: User }
  | { status: 'invalid'; userId?: string }
  | { status: 'locked'; userId: string; lockedUntil: Date }
  | { status: 'expired'; userId: string };

/** Express request after the AuthGuard: the signed-in user is attached. */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/** Express request before the AuthGuard has run: the user may be missing. */
export interface MaybeAuthenticatedRequest extends Request {
  user?: AuthUser;
}

/** GET /api/auth/session — null when not signed in. */
export interface SessionResponse {
  user: AuthUser | null;
}

/** What the session token is issued for. */
export interface SessionSubject {
  id: string;
  role: UserRole;
  tokenVersion: number;
}

/** Lookup of a user together with the password hash. */
export interface UserLookup {
  id?: string;
  email?: string;
}

/** Options of UsersService.create. */
export interface CreateUserOptions {
  mustChangePassword?: boolean;
  /** Do not send the «new head / new user» e-mails (seed, first admin). */
  silent?: boolean;
  /** The administrator who created the account: the letter with the temporary password is sent. */
  issuedBy?: AuthUser;
}

/** A temporary password just issued: shown to the administrator once, also e-mailed if possible. */
export interface IssuedTemporaryPassword {
  temporaryPassword: string;
  mailSent: boolean;
  expiresAt: Date;
}

/** Where the access is given: the legal entity and in what capacity (for the letter). */
export interface AccessContext {
  entityName: string;
  entityCode: string;
  asWhom: string;
}
