import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { KepLevel } from '../shared/interfaces/kep.interface.js';
import type { SignupRejectReason, SignupStatus } from '../shared/interfaces/signup.interface.js';

/**
 * A sign-up of a company by its head: the statement (code + e-mail) signed with KEP. Kept after the decision:
 * an approved one is the proof of who created the legal entity, a refused one — of an attempt.
 */
@Entity('signup_requests')
@Index(['status', 'createdAt'])
export class SignupRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  edrpou: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  /** The exact text that was offered for signing (UTF-8). */
  @Column({ type: 'text' })
  document: string;

  @Column({ type: 'varchar', length: 64 })
  documentSha256: string;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: SignupStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  reason: SignupRejectReason | null;

  @Column({ type: 'varchar', length: 500, default: '' })
  reasonText: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  signerName: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  signerDrfoMasked: string;

  @Column({ type: 'varchar', length: 10, default: '' })
  signerEdrpou: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  signerIssuer: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  registryHeadName: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  kepLevel: KepLevel | null;

  /** The statement and its .p7s in the write-once storage. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  signatureKey: string | null;

  @Column({ type: 'varchar', length: 64, default: '' })
  ip: string;

  @Column({ type: 'uuid', nullable: true })
  legalEntityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
