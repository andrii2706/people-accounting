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

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
