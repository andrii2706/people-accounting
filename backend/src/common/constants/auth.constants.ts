/** Route metadata keys of the auth decorators. */
export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const ALLOW_PENDING_PASSWORD = 'allowPendingPassword';
export const ALLOW_VENDOR = 'allowVendor';
export const ALLOW_UNASSIGNED = 'allowUnassigned';
export const ALLOW_PENDING_TERMS = 'allowPendingTerms';
export const ALLOW_UNPAID = 'allowUnpaid';
/** The sign-in service of the whole domain: any account, whatever applications it has. */
export const IDENTITY_ROUTE = 'identityRoute';

/** Error code that makes the frontend open the change-password page. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';
/** Error code: the account is not bound to a legal entity yet (the director adds his legal entity first). */
export const NO_LEGAL_ENTITY = 'NO_LEGAL_ENTITY';

/**
 * A password one person types for another (the administrator → the user): printable Latin characters without
 * spaces. A Cyrillic «а/о/с/е/і/р/х» looks the same as the Latin one in the letter but is another character,
 * and a space at the end is invisible — the user would type a different password and never get in.
 */
export const HANDED_OVER_PASSWORD = /^[\x21-\x7E]+$/;
export const HANDED_OVER_PASSWORD_PROBLEM = 'лише латинські літери, цифри й символи, без пробілів';

/**
 * Sign-ins per minute from one address. A whole office often goes out through one address, and successful
 * sign-ins count too — 5 locked out colleagues who had done nothing wrong. Guessing the password of one account
 * is stopped by the account lockout (MAX_FAILED_LOGINS failures → LOCKOUT_MINUTES).
 */
export const LOGIN_ATTEMPTS_PER_MINUTE = 20;
