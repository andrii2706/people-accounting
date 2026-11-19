/**
 * The session shared by all applications of one domain.
 * The identity service signs a JWT (ES256) and puts it into an httpOnly cookie for the whole domain (Path=/);
 * every application checks the signature locally with the public key from JWKS — no application but the
 * identity service can issue a session.
 */

/** Who signs the sessions and for whom they are. */
export const SESSION_ISSUER = 'mr-identity';
export const SESSION_AUDIENCE = 'mr-apps';
export const SESSION_ALGORITHM = 'ES256';

/** The public keys of the identity service (on the shared domain). */
export const JWKS_PATH = '/api/auth/.well-known/jwks.json';

/** The identity endpoints on the shared domain: sign-in, the current user, sign-out. */
export const AUTH_PATHS = {
  login: '/api/auth/login',
  session: '/api/auth/session',
  logout: '/api/auth/logout',
  changePassword: '/api/auth/change-password',
  /** GET …/:token — who the link from a letter is for; POST — a new password by it. */
  passwordReset: '/api/auth/password-reset',
} as const;

/** The sign-in page of the portal; `next` — where to return after it. */
export const LOGIN_PAGE = '/login';

/** The claims of the session token. */
export interface SessionClaims {
  /** The user id. */
  sub: string;
  role: string;
  /** The legal entity of the account; null — the main administrator (all) or not assigned yet. */
  ent: string | null;
  /** The applications the account may open (AppId). */
  mods: string[];
  /** The credentials version: a password change or a lockout ends the old sessions. */
  ver: number;
  /** When the session started (seconds) — the absolute limit of a session. */
  sst: number;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

/** The answer of GET /api/auth/session as the applications use it. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  legalEntityId: string | null;
  modules?: string[];
  /** «п. Галино» — the greeting in the vocative. */
  address?: string;
  mustChangePassword: boolean;
}

/** The error code an application answers with when the account has no access to it. */
export const MODULE_NOT_CONNECTED = 'MODULE_NOT_CONNECTED';
