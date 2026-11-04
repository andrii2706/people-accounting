import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { IsoDate } from '../shared/interfaces/common.interface.js';

/** Debt of the client for using the system. A single row (id = 1), set only by the vendor. */
@Entity('billing_status')
export class BillingStatusEntity {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'boolean', default: false })
  hasDebt: boolean;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: string | null;

  @Column({ type: 'date', nullable: true })
  debtSince: IsoDate | null;

  @Column({ type: 'varchar', length: 300, default: '' })
  paymentContact: string;

  /** When «є заборгованість» was switched on — one-time entries are counted from this moment. */
  @Column({ type: 'timestamptz', nullable: true })
  debtSetAt: Date | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  updatedBy: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
