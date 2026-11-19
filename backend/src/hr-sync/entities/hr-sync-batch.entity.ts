import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { encrypted } from '../../common/crypto/field-encryption.js';
import type {
  HrBatchCounts,
  HrBatchSource,
  HrBatchStatus,
  HrSystem,
} from '../../shared/interfaces/hr-sync.interface.js';

/**
 * One delivery of employees from 1C: what came (payload) and what it means for our cards (items).
 * Both are personal data — stored encrypted; kept HR_BATCH_KEEP_DAYS days, then deleted by the daily job.
 */
@Entity('hr_sync_batches')
@Index(['legalEntityId', 'receivedAt'])
export class HrSyncBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  legalEntityId: string;

  @Column({ type: 'varchar', length: 16 })
  source: HrBatchSource;

  @Column({ type: 'varchar', length: 20 })
  system: HrSystem;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: HrBatchStatus;

  /** JSON HrRecord[] as received. */
  @Column({ type: 'text', transformer: encrypted })
  payload: string;

  /** JSON HrBatchItem[] — the comparison with our cards (and the results after applying). */
  @Column({ type: 'text', transformer: encrypted })
  items: string;

  @Column({ type: 'jsonb' })
  counts: HrBatchCounts;

  @Column({ type: 'varchar', length: 500, default: '' })
  message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  appliedAt: Date | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  appliedBy: string;
}
