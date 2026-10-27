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

export type SignatureMethod = 'WIDGET' | 'UPLOAD';
export type SignatureVerification = 'VALID' | 'DIGEST_MATCH' | 'UNVERIFIED';

/** Summary for one signer in a .p7s file (a file may contain several). */
export interface SignerSummary {
  name: string;
  title: string;
  organization: string;
  edrpou: string;
  /** RNOKPP of the key owner — last 4 digits only. */
  drfoMasked: string;
  issuer: string;
  certificateSerial: string;
  certificateValidFrom: string;
  certificateValidTo: string;
  signingTime: string | null;
  hasTimestamp: boolean;
  digestAlgorithm: string;
  signatureAlgorithm: string;
  verification: SignatureVerification;
  notes: string[];
}

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
