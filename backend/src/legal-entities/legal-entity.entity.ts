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
import { decimalColumn } from '../common/utils/column.utils.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import { User } from '../users/user.entity.js';
import type { LabelSettings } from '../shared/interfaces/label-settings.interface.js';

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

  /**
   * Reservation quota in percent (e.g. 50): places = percent × working military-liable men, rounded down.
   * null — not set.
   */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: decimalColumn })
  reservationQuotaPercent: number | null;

  /** The document that granted the criticality (and the quota): its name… */
  @Column({ type: 'varchar', length: 300, default: '' })
  reservationQuotaDocName: string;

  /** …the authority that issued it… */
  @Column({ type: 'varchar', length: 300, default: '' })
  reservationQuotaAuthority: string;

  /** …its date and number… */
  @Column({ type: 'date', nullable: true })
  reservationQuotaDocDate: IsoDate | null;

  @Column({ type: 'varchar', length: 100, default: '' })
  reservationQuotaDocNumber: string;

  /** …and the last day of the criticality (inclusive); after it no new reservations under the quota. */
  @Column({ type: 'date', nullable: true })
  reservationQuotaValidUntil: IsoDate | null;

  /** Extra e-mail addresses for the reminders about the employees of this legal entity, comma-separated. */
  @Column({ type: 'varchar', length: 500, default: '' })
  notifyEmails: string;

  /** Signed up by its director himself — works by subscription (plan, invoices); false — the old flow. */
  @Column({ type: 'boolean', default: false })
  billingRequired: boolean;

  /** The offer version the head signed with KEP (subscriptions/terms.constants.ts); null — not signed. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  offerVersion: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  offerSignedAt: Date | null;

  /** How its envelope labels are printed (font, sizes, A4 sheet or envelope). null — the defaults. */
  @Column({ type: 'jsonb', nullable: true })
  labelSettings: Partial<LabelSettings> | null;

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
