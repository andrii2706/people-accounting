import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { encrypted } from '../common/crypto/field-encryption.js';
import type { SignupSource, UserRole } from '../shared/interfaces/auth.interface.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 200, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 200 })
  fullName: string;

  @Column({ type: 'varchar', length: 20, default: 'HR' })
  role: UserRole;

  /**
   * The legal entity of the account: everyone except the main administrator sees only its data.
   * null — the main administrator / vendor, or a director who has not added his legal entity yet.
   */
  @Column({ type: 'uuid', nullable: true })
  legalEntityId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * The applications the account may open (oblik, kadry, docs — see platform/contracts/apps). The main
   * administrator opens all of them whatever is stored here.
   */
  @Column({ type: 'simple-array', default: 'oblik' })
  modules: string[];

  /** Receive e-mail reminders (deferral / reservation ending, mobilization extended…). */
  @Column({ type: 'boolean', default: true })
  notify: boolean;

  /** Incremented on password change / lockout — all issued sessions become invalid. */
  @Column({ type: 'int', default: 0, select: false })
  tokenVersion: number;

  @Column({ type: 'int', default: 0, select: false })
  failedLoginCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  /** Temporary password from an administrator — must be changed on first sign-in. */
  @Column({ type: 'boolean', default: false })
  mustChangePassword: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  /** A temporary password (set by the administrator) stops working after this moment. */
  @Column({ type: 'timestamptz', nullable: true, select: false })
  temporaryPasswordExpiresAt: Date | null;

  /** One-time entry while there is a debt for using the system: when it was used. */
  @Column({ type: 'timestamptz', nullable: true })
  debtGraceUsedAt: Date | null;

  /** Two-step sign-in: the secret of the authenticator app (encrypted); set but not enabled — being set up. */
  @Column({ type: 'text', nullable: true, select: false, transformer: encrypted })
  mfaSecret: string | null;

  /** When the code from the app was turned on; null — sign-in with the password only. */
  @Column({ type: 'timestamptz', nullable: true })
  mfaEnabledAt: Date | null;

  /** Hashes of the unused recovery codes (each works once). */
  @Column({ type: 'jsonb', default: [], select: false })
  mfaRecoveryHashes: string[];

  /** The step (30 s) of the last accepted code: the same code is not accepted twice. */
  @Column({ type: 'int', nullable: true, select: false })
  mfaLastStep: number | null;

  /** Wrong codes in a row; reset by a right one, not by the password. */
  @Column({ type: 'int', default: 0, select: false })
  mfaFailedCount: number;

  /** ADMIN — the account was created by an administrator; SELF — the director signed up himself. */
  @Column({ type: 'varchar', length: 10, default: 'ADMIN' })
  signupSource: SignupSource;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
