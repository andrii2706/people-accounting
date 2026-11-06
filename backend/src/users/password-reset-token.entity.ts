import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { PasswordLinkPurpose } from '../shared/interfaces/auth.interface.js';
import { User } from './user.entity.js';

/**
 * A link to set a new password (from the letter «your password expires» or the administrator's request).
 * Only the SHA-256 of the token is stored; the link works once and for a limited time.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index('IDX_password_reset_tokens_user')
  @Column({ type: 'uuid' })
  userId: string;

  @Index('UQ_password_reset_tokens_hash', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 20 })
  purpose: PasswordLinkPurpose;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
