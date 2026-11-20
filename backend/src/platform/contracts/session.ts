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
  /** The second step of the sign-in: the code from the app (or a recovery code) for the ticket. */
  loginCode: '/api/auth/login/code',
  /** The first sign-in of a role that needs the code: a new secret (QR) for the ticket… */
  loginSetup: '/api/auth/login/setup',
  /** …and the first code from the app turns it on and signs in. */
  loginEnable: '/api/auth/login/enable',
  /**
   * The code of one's own account (any application): GET — on or off; POST …/setup (password) → QR,
   * …/enable (code) → recovery codes, …/recovery-codes and …/disable (password + code).
   */
  mfa: '/api/auth/mfa',
} as const;

/**
 * The answer of the sign-in when the password was right but one more step is needed:
 * CODE — the code from the authenticator app, SETUP — the app is to be set up first.
 * No session is issued until then; the ticket lives a few minutes and is good only for that step.
 */
export interface LoginChallenge {
  twoFactor: 'CODE' | 'SETUP';
  ticket: string;
  expiresAt: string;
}

export const isLoginChallenge = (x: unknown): x is LoginChallenge =>
  !!x && typeof x === 'object' && 'twoFactor' in x && 'ticket' in x;

/** A new secret for the authenticator app: the QR code as a grid of cells («1» — dark) and as text. */
export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qr: { size: number; cells: string };
}

/** Is the code from the app on for one's own account (GET AUTH_PATHS.mfa). */
export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  /** The role cannot sign in without it. */
  required: boolean;
  recoveryLeft: number;
}

/** New recovery codes (shown once) with the status after the change. */
export interface TwoFactorCodes {
  recoveryCodes: string[];
  status: TwoFactorStatus;
}

/** The code from the app is on: the recovery codes are shown once. */
export interface TwoFactorEnabled<U = SessionUser> {
  user: U;
  recoveryCodes: string[];
}

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
