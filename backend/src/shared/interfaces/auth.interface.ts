import type { Request } from 'express';

import type { User } from '../../users/user.entity.js';
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** The legal entity the account belongs to — it sees only its data; null — the main administrator (sees all) or not yet assigned. */
  legalEntityId: string | null;
  mustChangePassword: boolean;
  /** When the password stops working (HR / DIRECTOR — half a year after the change); null — never. */
  passwordExpiresAt?: string | null;
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

/**
 * ADMIN — the main administrator: all legal entities, all data, all accounts.
 * ENTITY_ADMIN — administrator of one legal entity: its employees, documents, card, accounts (HR / director).
 * DIRECTOR — the head of one legal entity: the same as ENTITY_ADMIN, and adds his legal entity himself.
 * HR — responsible for the military registration in one legal entity: employees, notices, letters, reports.
 * VENDOR — the system's supplier: sees only the payment page, no personal data.
 */
export type UserRole = 'ADMIN' | 'ENTITY_ADMIN' | 'DIRECTOR' | 'HR' | 'VENDOR';

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

/** A new account of a legal entity's person: the letter context + the legal entity it belongs to. */
export interface EntityAccountContext extends AccessContext {
  legalEntityId: string;
}

/** Why a link to set a new password was sent. */
export type PasswordLinkPurpose = 'EXPIRING' | 'ADMIN_REQUEST';

/** GET /auth/password-reset/:token — the link is valid; who it is for. */
export interface PasswordLinkInfo {
  email: string;
  fullName: string;
  purpose: PasswordLinkPurpose;
  expiresAt: Date;
}

/** POST /users/:id/password-change-request */
export interface PasswordChangeRequestResult {
  mailSent: boolean;
  email: string;
}

/** Fields the password age is computed from. */
export interface PasswordAgeFields {
  role: UserRole;
  passwordChangedAt: Date | null;
}

/** Which legal entity a request may touch: its id, or null — all of them (the main administrator). */
export type Scope = string | null;

/** A local test account (npm run seed:accounts): fictional, never in production. */
export interface TestAccount {
  email: string;
  fullName: string;
  role: UserRole;
  /** Which demo legal entity: A — the first one, B — the second demo one, null — none (the director adds his). */
  entity: 'A' | 'B' | null;
  /** What to try with it. */
  purpose: string;
}
