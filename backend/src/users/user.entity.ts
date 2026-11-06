import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { UserRole } from '../shared/interfaces/auth.interface.js';

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
