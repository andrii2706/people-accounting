import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/utils/column.utils.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type {
  BuyerDetails,
  InvoiceStatus,
  PlanCode,
  SellerDetails,
} from '../shared/interfaces/subscription.interface.js';

/**
 * An invoice for the access («рахунок на оплату»). The seller and the buyer are copied at issue time —
 * a later change of the requisites does not change an issued invoice.
 */
@Entity('invoices')
@Index(['year', 'sequence'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  number: string;

  /** null — the subscription was deleted together with its legal entity; the invoice stays (accounting). */
  @Column({ type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  legalEntityId: string | null;

  @Column({ type: 'varchar', length: 20 })
  plan: PlanCode;

  @Column({ type: 'date' })
  periodFrom: IsoDate;

  @Column({ type: 'date' })
  periodTo: IsoDate;

  /** The line of the invoice: the service, the plan, the period. */
  @Column({ type: 'varchar', length: 500 })
  description: string;

  /** Without VAT / VAT / to pay, UAH. */
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalColumn })
  net: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalColumn })
  vatAmount: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalColumn })
  total: number;

  @Column({ type: 'date' })
  issuedAt: IsoDate;

  @Column({ type: 'date' })
  dueDate: IsoDate;

  @Column({ type: 'varchar', length: 20, default: 'ISSUED' })
  status: InvoiceStatus;

  @Column({ type: 'date', nullable: true })
  paidAt: IsoDate | null;

  @Column({ type: 'jsonb' })
  seller: SellerDetails;

  @Column({ type: 'jsonb' })
  buyer: BuyerDetails;

  @Column({ type: 'varchar', length: 200, default: '' })
  createdBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
