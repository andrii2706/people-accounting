/**
 * ADMIN — the main administrator: all legal entities. ENTITY_ADMIN — administrator of one legal entity.
 * DIRECTOR — the head of one legal entity (adds it himself). HR — responsible for the military registration.
 * VENDOR — the system's supplier: sees only the payment page.
 */
export type UserRole = 'ADMIN' | 'ENTITY_ADMIN' | 'DIRECTOR' | 'HR' | 'VENDOR';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** The legal entity of the account — it sees only its data; null — the main administrator, or not assigned yet. */
  legalEntityId: string | null;
  /** Temporary password from an administrator — must be changed before working. */
  mustChangePassword: boolean;
  /** When the password stops working (HR / director — half a year after the change); null — never. */
  passwordExpiresAt?: string | null;
  /** ADMIN — created by an administrator; SELF — the director signed up himself. */
  signupSource?: SignupSource;
  /** The legal entity has accepted the current offer (the head's KEP); true when not required. */
  termsAccepted?: boolean;
}

export type SignupSource = 'ADMIN' | 'SELF';

/** Step 1 of the sign-up: the code of the legal entity and the head's work e-mail. `website` is a trap for bots. */
export interface SignupStatementRequest {
  edrpou: string;
  email: string;
  consent: boolean;
  website: string;
}

/** The statement the head signs with KEP (the same shape as the offer document). */
export interface SignupStatement extends SignDocument {
  id: string;
  expiresAt: string;
}

/** A document offered for KEP signing: the exact bytes in base64. */
export interface SignDocument {
  fileName: string;
  content: string;
}

export type SignupStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type SignupRejectReason =
  | 'SIGNATURE_INVALID'
  | 'CERT_EDRPOU_MISMATCH'
  | 'NOT_IN_REGISTRY'
  | 'TERMINATED'
  | 'NOT_HEAD'
  | 'ENTITY_EXISTS';

/** A row of «Реєстрації компаній» (the main administrator). */
export interface SignupRequestView {
  id: string;
  edrpou: string;
  email: string;
  status: SignupStatus;
  reason: SignupRejectReason | null;
  reasonText: string;
  signerName: string;
  signerDrfoMasked: string;
  signerEdrpou: string;
  signerIssuer: string;
  registryHeadName: string;
  kepLevel: KepLevel | null;
  ip: string;
  createdAt: string;
  completedAt: string | null;
  legalEntityId: string | null;
}

export type KepLevel = 'QUALIFIED' | 'BASIC';

/** The IIT widget settings (signing right on the page). */
export interface WidgetConfig {
  enabled: boolean;
  scriptUrl: string;
  frameUrl: string;
}

/** Account in the user list (administration). */
export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  legalEntityId: string | null;
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
  /** The main administrator chooses it; for the others it is their own. */
  legalEntityId?: string | null;
}

/** PATCH /api/users/:id */
export interface UpdateUserRequest {
  isActive?: boolean;
  role?: UserRole;
  legalEntityId?: string | null;
  fullName?: string;
  notify?: boolean;
}

/** POST /api/users/:id/reset-password */
export interface PasswordResetResult {
  temporaryPassword: string;
  /** The password was also e-mailed to the user (from the access mailbox). */
  mailSent: boolean;
  expiresAt: string;
}

/** A temporary password shown once to the administrator. */
export interface IssuedPassword {
  user: string;
  password: string;
  /** E-mailed to this address; empty — not sent (mail is not set), hand it over yourself. */
  mailedTo?: string;
  expiresAt?: string | null;
}

/** GET/PATCH /api/auth/preferences */
export interface UserPreferences {
  notify: boolean;
}

/** GET /api/auth/password-reset/:token — who the link from the letter is for. */
export interface PasswordLinkInfo {
  email: string;
  fullName: string;
  purpose: 'EXPIRING' | 'ADMIN_REQUEST';
  expiresAt: string;
}

/** The «new password» form opened from a letter. */
export interface NewPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

/** POST /api/users/:id/password-change-request */
export interface PasswordChangeRequestResult {
  mailSent: boolean;
  email: string;
}

/** GET /api/auth/register — is the self sign-up on. */
export interface SignupInfo {
  enabled: boolean;
  widget: WidgetConfig;
}

/** A plain answer with a text for the user. */
export interface MessageResponse {
  message: string;
}
