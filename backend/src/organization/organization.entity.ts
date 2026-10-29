import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Company details (sheet G). A single row with id = 1. */
@Entity('organization')
export class Organization {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  /** «Товариство з обмеженою відповідальністю «…»» */
  @Column({ type: 'varchar', length: 500, default: '' })
  fullName: string;

  /** Locative case: «Товаристві з обмеженою відповідальністю «…»» — for «які працюють в …». */
  @Column({ type: 'varchar', length: 500, default: '' })
  nameLocative: string;

  /** «ТзОВ «…»» */
  @Column({ type: 'varchar', length: 300, default: '' })
  shortName: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  edrpou: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  address: string;

  /** Postal code for envelope labels. */
  @Column({ type: 'varchar', length: 10, default: '' })
  postalCode: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  email: string;

  /** Position of the head for signatures («Директор»). */
  @Column({ type: 'varchar', length: 200, default: 'Директор' })
  headPosition: string;

  /** Initials and surname of the head («І. ПРІЗВИЩЕ»). */
  @Column({ type: 'varchar', length: 200, default: '' })
  headName: string;

  /** Prefix of the outgoing letter number, e.g. «ВО-». */
  @Column({ type: 'varchar', length: 30, default: '' })
  letterNumberPrefix: string;

  /** How many days in advance to warn about the end of a reservation/deferral. */
  @Column({ type: 'int', default: 30 })
  alertDays: number;

  /** Deadline for notifying the TCK about changes, in days. */
  @Column({ type: 'int', default: 7 })
  notifyDeadlineDays: number;

  /** Reservation quota: how many employees may be reserved (decision of the authority). Empty — not set. */
  @Column({ type: 'int', nullable: true })
  reservationQuota: number | null;

  /** Grounds of the quota (decision / letter number and date). */
  @Column({ type: 'varchar', length: 300, default: '' })
  reservationQuotaBasis: string;

  /** General mobilization lasts until (from the latest presidential decree; updated by the daily job). */
  @Column({ type: 'date', nullable: true })
  mobilizationUntil: string | null;

  /** The decree the date comes from, e.g. «Указ № 1061/2026 від 26.10.2026». */
  @Column({ type: 'varchar', length: 300, default: '' })
  mobilizationDecree: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  mobilizationSource: string;

  /** When the decrees were last checked automatically. */
  @Column({ type: 'timestamptz', nullable: true })
  mobilizationCheckedAt: Date | null;

  /** Extra addresses for e-mail reminders (comma-separated), besides the users. */
  @Column({ type: 'varchar', length: 500, default: '' })
  notifyEmails: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
