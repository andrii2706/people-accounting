import bcrypt from 'bcryptjs';
import type { UserRole } from '../shared/interfaces/auth.interface.js';

/** Roles a user can have. */
export const USER_ROLES: UserRole[] = ['ADMIN', 'HR'];

export const BCRYPT_ROUNDS = 12;

/** Hash used to equalize response time when the email does not exist (protection against email enumeration). */
export const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-password', BCRYPT_ROUNDS);
