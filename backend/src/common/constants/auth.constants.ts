/** Route metadata keys of the auth decorators. */
export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const ALLOW_PENDING_PASSWORD = 'allowPendingPassword';
export const ALLOW_VENDOR = 'allowVendor';
export const ALLOW_DIRECTOR = 'allowDirector';
/** Methods that only read — the director may call any of them. */
export const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Error code that makes the frontend open the change-password page. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';
