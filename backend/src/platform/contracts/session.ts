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

/** The identity endpoints under a base: the identity service itself (/api/auth) or the portal API (/api/portal/auth). */
export function authPathsAt(base: string) {
  return {
    login: `${base}/login`,
    session: `${base}/session`,
    logout: `${base}/logout`,
    changePassword: `${base}/change-password`,
    /** GET …/:token — who the link from a letter is for; POST — a new password by it. */
    passwordReset: `${base}/password-reset`,
    /** The second step of the sign-in: the code from the app (or a recovery code) for the ticket. */
    loginCode: `${base}/login/code`,
    /** The first sign-in of a role that needs the code: a new secret (QR) for the ticket… */
    loginSetup: `${base}/login/setup`,
    /** …and the first code from the app turns it on and signs in. */
    loginEnable: `${base}/login/enable`,
    /**
     * The code of one's own account (any application): GET — on or off; POST …/setup (password) → QR,
     * …/enable (code) → recovery codes, …/recovery-codes and …/disable (password + code).
     */
    mfa: `${base}/mfa`,
    /** GET — what the account may open in every module right now (ModuleAccess[]). */
    access: `${base}/access`,
  };
}

export type AuthPaths = ReturnType<typeof authPathsAt>;

/** The identity service on the shared domain — the applications call it directly. */
export const AUTH_PATHS = authPathsAt('/api/auth');

/**
 * The portal calls only its own API: it signs in to the identity service on the server side, passes the session
 * cookie back and adds what the portal needs (the state of every module).
 */
export const PORTAL_AUTH_BASE = '/api/portal/auth';
export const PORTAL_AUTH_PATHS = authPathsAt(PORTAL_AUTH_BASE);

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

/**
 * The ticket the portal gives a module for one sign-in (SSO): ES256, signed with the session key of the portal,
 * for one module (`aud`), valid for a minute and once (`jti`). The module checks it with the portal's JWKS,
 * finds (or adds) its own account by the email and issues its own session.
 */
export interface SsoTicketClaims {
  typ: 'sso';
  sub: string;
  email: string;
  name: string;
  role: string;
  /** The company of the account: ЄДРПОУ and name — the module ties its account to its own legal entity. */
  company: { code: string; name: string } | null;
  /** Where to go in the module after it (a path on the domain, /oblik/…). */
  next: string;
  jti: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
}

export const SSO_TICKET_TYPE = 'sso';
/** How long a ticket lives, seconds — it is used at once by the redirect. */
export const SSO_TICKET_SECONDS = 60;
/** Where a module takes the ticket (on its own path of the domain). */
export const SSO_PATH = 'api/auth/sso';

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

/** The error code of a module whose use is not paid (a debt for the system): the module is closed, the sign-in is not. */
export const BILLING_DEBT = 'BILLING_DEBT';

/** `next` of a module: a path inside the module (/oblik/…), otherwise the module's start — never another site. */
export function safeNextPath(next: string | null | undefined, within: string, fallback: string): string {
  return typeof next === 'string' && next.startsWith(within) && !next.includes('//') && !next.includes('\\')
    ? next
    : fallback;
}
