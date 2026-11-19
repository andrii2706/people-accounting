import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { encrypted } from '../../common/crypto/field-encryption.js';
import type {
  HrBatchStatus,
  HrMilitaryPolicy,
  HrSyncMode,
  HrSystem,
} from '../../shared/interfaces/hr-sync.interface.js';

/**
 * Where a legal entity takes its employees from (1C ЗУП / BAS) and how. The OData password is encrypted
 * (AES-256-GCM, DATA_ENCRYPTION_KEY); of the push key only its SHA-256 is kept — it is shown once.
 */
@Entity('hr_sync_settings')
export class HrSyncSettings {
  @PrimaryColumn({ type: 'uuid' })
  legalEntityId: string;

  @Column({ type: 'varchar', length: 20, default: 'ZUP' })
  system: HrSystem;

  @Column({ type: 'varchar', length: 10, default: 'PUSH' })
  mode: HrSyncMode;

  @Column({ type: 'varchar', length: 500, default: '' })
  odataUrl: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  odataUser: string;

  @Column({ type: 'text', transformer: encrypted, default: '' })
  odataPassword: string;

  @Column({ type: 'varchar', length: 10, default: '' })
  organizationCode: string;

  @Column({ type: 'boolean', default: false })
  scheduleEnabled: boolean;

  @Column({ type: 'int', default: 6 })
  scheduleHour: number;

  @Column({ type: 'boolean', default: true })
  autoApply: boolean;

  @Column({ type: 'varchar', length: 12, default: 'FILL_EMPTY' })
  militaryPolicy: HrMilitaryPolicy;

  @Column({ type: 'boolean', default: false })
  importDismissed: boolean;

  /** SHA-256 (hex) of the secret part of the push key. */
  @Column({ type: 'varchar', length: 64, default: '' })
  tokenHash: string;

  /** The public start of the key («mr1c_3f9a1c2b») — finds the settings without a scan. */
  @Column({ type: 'varchar', length: 20, default: '' })
  tokenPrefix: string;

  @Column({ type: 'timestamptz', nullable: true })
  tokenIssuedAt: Date | null;

  /** Whose name the automatic runs carry in the journal and the TCK queue. */
  @Column({ type: 'uuid', nullable: true })
  configuredById: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  configuredBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  lastStatus: HrBatchStatus | null;

  @Column({ type: 'varchar', length: 500, default: '' })
  lastMessage: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
