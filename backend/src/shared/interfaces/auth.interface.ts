import type { Request } from 'express';

import type { User } from '../../users/user.entity.js';
export type SessionEntry = 'portal' | 'login';

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
  /** ADMIN — created by an administrator; SELF — signed up himself (a director of his company). */
  signupSource?: SignupSource;
  /** The current version of the agreement is accepted (the main administrator and the vendor — always). */
  termsAccepted?: boolean;
  /** How the screen addresses the person, in the vocative: «п. Галино»; '' — without a name. */
  address?: string;
  /** The applications the account may open (oblik, kadry, docs). */
  modules?: string[];
  /** How this session began (GET /api/auth/me only). */
  via?: SessionEntry;
}

export type SignupSource = 'ADMIN' | 'SELF';

export interface SessionPayload {
  sub: string;
  /** Credentials version — after a password change / lockout old sessions become invalid. */
  ver: number;
  /** Session start (seconds) — for the absolute session lifetime limit. */
  sst: number;
  role: UserRole;
  /**
   * How the person came in: from the portal (a ticket) — «Вийти» takes them back to the portal; through the sign-in
   * of this application — to its sign-in page.
   */
  via?: SessionEntry;
  /** The shared session (ES256): the legal entity and the applications — for the other applications. */
  ent?: string | null;
  mods?: string[];
  iss?: string;
  aud?: string;
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
  /** fresh — locked just now by this attempt (not an attempt while already locked). */
  | { status: 'locked'; userId: string; lockedUntil: Date; fresh?: boolean }
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
  legalEntityId?: string | null;
  modules?: string[];
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

/** The claims of the ticket between the password and the code (never a session). */
export interface MfaTicket {
  sub: string;
  ver: number;
  typ: string;
  step: 'CODE' | 'SETUP';
}

/** How a code from the app (or a recovery code) went. */
export type MfaCodeResult =
  | { status: 'ok' }
  | { status: 'recovery'; left: number }
  | { status: 'invalid'; left: number }
  | { status: 'locked'; lockedUntil: Date };

/** The second step of one's own account (Profile). */
export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  /** The role cannot sign in without it (MFA_REQUIRED_ROLES). */
  required: boolean;
  recoveryLeft: number;
}

/**
 * Why the entrance from the portal (SSO) was refused — goes to the sign-in page of the module as ?sso=…:
 * off — PORTAL_JWKS_URL is not set; keys — the keys of the portal could not be fetched or do not know the ticket;
 * expired / used — the ticket is old or opened already; invalid — not a ticket of the portal for this module;
 * account — the account of this module is switched off.
 */
export type SsoFailure = 'off' | 'keys' | 'expired' | 'used' | 'invalid' | 'account';
