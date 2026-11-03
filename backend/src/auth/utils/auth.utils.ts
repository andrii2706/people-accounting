import type { AuthUser } from '../../shared/interfaces/auth.interface.js';

/** Only the public fields of a user (the entity also holds hashes and counters). */
export const toAuthUser = (u: AuthUser): AuthUser => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  mustChangePassword: u.mustChangePassword,
});
