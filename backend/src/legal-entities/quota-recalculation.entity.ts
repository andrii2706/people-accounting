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
import { decimalColumn } from '../common/utils/column.utils.js';
import { LegalEntity } from './legal-entity.entity.js';

/** One recalculation of the reservation quota of a legal entity — written when the base, the places or the reserved changed. */
@Entity('quota_recalculations')
@Index(['legalEntityId', 'createdAt'])
export class QuotaRecalculation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LegalEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legalEntityId' })
  legalEntity: Relation<LegalEntity>;

  @Column({ type: 'uuid' })
  legalEntityId: string;

  /** What happened: «Звільнено: Зразкова М. І.», «Змінено відсоток квоти: 50 %», «Щоденна перевірка». */
  @Column({ type: 'varchar', length: 300, default: '' })
  reason: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: decimalColumn })
  percent: number | null;

  @Column({ type: 'int' })
  base: number;

  @Column({ type: 'int', nullable: true })
  quota: number | null;

  @Column({ type: 'int' })
  reservedCompany: number;

  @Column({ type: 'int', nullable: true })
  available: number | null;

  @Column({ type: 'boolean', default: false })
  exceeded: boolean;

  @Column({ type: 'int', nullable: true })
  prevBase: number | null;

  @Column({ type: 'int', nullable: true })
  prevQuota: number | null;

  @Column({ type: 'int', nullable: true })
  prevReserved: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
