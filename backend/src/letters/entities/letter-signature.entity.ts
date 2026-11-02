import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { OutgoingLetter } from './outgoing-letter.entity.js';
import type {
  SignatureMethod,
  SignerSummary,
  SignatureVerification,
} from '../../shared/interfaces/signature.interface.js';

/**
 * Qualified e-signature file (CAdES detached, .p7s) for the frozen document of a letter.
 * Records are append-only: a signature cannot be changed or deleted.
 */
@Entity('letter_signatures')
@Index(['letterId', 'fileSha256'], { unique: true })
export class LetterSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  letterId: string;

  @ManyToOne(() => OutgoingLetter, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'letterId' })
  letter: Relation<OutgoingLetter>;

  /** SHA-256 of the document that was signed (= OutgoingLetter.documentSha256 at signing time). */
  @Column({ type: 'varchar', length: 64 })
  documentSha256: string;

  /** Storage key of the .p7s file. */
  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  /** SHA-256 of the signature file itself — protection against duplicates. */
  @Column({ type: 'varchar', length: 64 })
  fileSha256: string;

  @Column({ type: 'int' })
  fileSize: number;

  @Column({ type: 'varchar', length: 20 })
  method: SignatureMethod;

  /** The weakest status among the signers in the file. */
  @Column({ type: 'varchar', length: 20 })
  verification: SignatureVerification;

  @Column({ type: 'jsonb', default: [] })
  signers: SignerSummary[];

  @Column({ type: 'uuid', nullable: true })
  uploadedById: string | null;

  @Column({ type: 'varchar', length: 300, default: '' })
  uploadedByName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
