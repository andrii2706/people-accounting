import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../users/user.entity.js';

/**
 * A legal entity of the client (a company of the group). Employees belong to one; lists, TCK notices and reports
 * are formed per legal entity with its own requisites, head and person responsible for military registration.
 */
@Entity('legal_entities')
export class LegalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  fullName: string;

  /** Locative case: «Товаристві з обмеженою відповідальністю «…»» — for «які працюють в …». */
  @Column({ type: 'varchar', length: 500, default: '' })
  nameLocative: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  shortName: string;

  /** ЄДРПОУ (8 digits) or РНОКПП of a sole proprietor (10). */
  @Column({ type: 'varchar', length: 10, unique: true })
  edrpou: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  address: string;

  @Column({ type: 'varchar', length: 10, default: '' })
  postalCode: string;

  /** «+380671234567» — the country code and digits only. */
  @Column({ type: 'varchar', length: 20, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  email: string;

  /** Prefix of the outgoing number: «ВО-» → ВО-15. */
  @Column({ type: 'varchar', length: 30, default: '' })
  letterNumberPrefix: string;

  @Column({ type: 'varchar', length: 200, default: 'Директор' })
  headPosition: string;

  /** As in the signature: «Іван ПЕТРЕНКО». */
  @Column({ type: 'varchar', length: 200, default: '' })
  headName: string;

  /** Person responsible for military registration — the executor in the documents. */
  @Column({ type: 'varchar', length: 200, default: '' })
  responsibleName: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  responsiblePosition: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  responsiblePhone: string;

  /** The user account of the head (access to the system), if any. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'headUserId' })
  headUser: Relation<User> | null;

  @Column({ type: 'uuid', nullable: true })
  headUserId: string | null;

  /** Reservation quota — how many employees this legal entity may reserve; null — not set. */
  @Column({ type: 'int', nullable: true })
  reservationQuota: number | null;

  /** Basis of the quota (decision on criticality, order…). */
  @Column({ type: 'varchar', length: 300, default: '' })
  reservationQuotaBasis: string;

  /** Extra e-mail addresses for the reminders about the employees of this legal entity, comma-separated. */
  @Column({ type: 'varchar', length: 500, default: '' })
  notifyEmails: string;

  /** The user account of the responsible person (who works in the system), if any. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsibleUserId' })
  responsibleUser: Relation<User> | null;

  @Column({ type: 'uuid', nullable: true })
  responsibleUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
