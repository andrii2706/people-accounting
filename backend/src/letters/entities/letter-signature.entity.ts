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

/** Підсумок по одному підписувачу у файлі .p7s (у файлі їх може бути кілька). */
export interface SignerSummary {
  name: string;
  title: string;
  organization: string;
  edrpou: string;
  /** РНОКПП власника ключа — лише останні 4 цифри. */
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
 * Файл підпису КЕП (CAdES detached, .p7s) до зафіксованого документа листа.
 * Записи лише додаються: підпис не можна змінити чи видалити.
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

  /** SHA-256 документа, під який зроблено підпис (= OutgoingLetter.documentSha256 на момент підпису). */
  @Column({ type: 'varchar', length: 64 })
  documentSha256: string;

  /** Ключ файлу .p7s у сховищі. */
  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  /** SHA-256 самого файлу підпису — захист від дублю. */
  @Column({ type: 'varchar', length: 64 })
  fileSha256: string;

  @Column({ type: 'int' })
  fileSize: number;

  @Column({ type: 'varchar', length: 20 })
  method: SignatureMethod;

  /** Найслабший статус серед підписувачів у файлі. */
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
