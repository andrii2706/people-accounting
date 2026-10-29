import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type UserRole = 'ADMIN' | 'HR';

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
