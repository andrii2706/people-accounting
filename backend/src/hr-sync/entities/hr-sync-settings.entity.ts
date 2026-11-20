import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { encrypted } from '../../common/crypto/field-encryption.js';
import type {
  HrBatchStatus,
  HrMilitaryPolicy,
  HrSyncFrequency,
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

  /** ONCE — a single initial load; ONGOING — daily and by hand. */
  @Column({ type: 'varchar', length: 10, default: 'ONGOING' })
  frequency: HrSyncFrequency;

  /** ONCE: when the data were applied — then the integration takes nothing more. */
  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  /** ONCE + PUSH: the first push — the parts of a big company are accepted for HR_ONCE_PUSH_WINDOW_MS after it. */
  @Column({ type: 'timestamptz', nullable: true })
  firstPushAt: Date | null;

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

  /** The key stops working after this moment; null — until it is revoked. */
  @Column({ type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  /** Addresses / networks the key is accepted from, comma-separated; '' — any. */
  @Column({ type: 'varchar', length: 500, default: '' })
  pushAllowedIps: string;

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
