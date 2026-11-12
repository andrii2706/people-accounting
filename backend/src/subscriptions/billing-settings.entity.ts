import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { decimalColumn } from '../common/utils/column.utils.js';
import type { SellerDetails } from '../shared/interfaces/subscription.interface.js';

/** Prices and the seller's requisites — one row, edited by the vendor. */
@Entity('billing_settings')
export class BillingSettings {
  @PrimaryColumn({ type: 'int' })
  id: number;

  /** Requisites of the seller printed on the invoices and the agreement. */
  @Column({ type: 'jsonb', nullable: true })
  seller: Partial<SellerDetails> | null;

  /** UAH to pay per month / per year (with VAT, if the seller pays it); null — the plan is not offered yet. */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: decimalColumn })
  monthlyPrice: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: decimalColumn })
  yearlyPrice: number | null;

  @Column({ type: 'varchar', length: 1000, default: '' })
  enterpriseText: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  serviceName: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  invoicePrefix: string;

  @Column({ type: 'int', default: 5 })
  dueDays: number;

  @Column({ type: 'int', default: 14 })
  trialDays: number;

  @Column({ type: 'varchar', length: 200, default: '' })
  updatedBy: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
