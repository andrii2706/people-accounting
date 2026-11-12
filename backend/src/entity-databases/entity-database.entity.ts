import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { encrypted } from '../common/crypto/field-encryption.js';
import type { DatabaseCheckStatus, DbSslMode } from '../shared/interfaces/entity-database.interface.js';

/**
 * The own PostgreSQL of a legal entity (stage 1: the connection is kept and checked; the data still live
 * in the main database). The password is encrypted (AES-256-GCM, DATA_ENCRYPTION_KEY) and never sent out.
 */
@Entity('entity_databases')
export class EntityDatabase {
  @PrimaryColumn({ type: 'uuid' })
  legalEntityId: string;

  @Column({ type: 'varchar', length: 255 })
  host: string;

  @Column({ type: 'int', default: 5432 })
  port: number;

  @Column({ type: 'varchar', length: 63 })
  database: string;

  @Column({ type: 'varchar', length: 63 })
  username: string;

  @Column({ type: 'text', transformer: encrypted })
  password: string;

  @Column({ type: 'varchar', length: 20, default: 'require' })
  sslMode: DbSslMode;

  @Column({ type: 'varchar', length: 20, default: 'NEW' })
  status: DatabaseCheckStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @Column({ type: 'varchar', length: 500, default: '' })
  lastError: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  serverVersion: string;

  /** The account may create tables (needed when the data move there). */
  @Column({ type: 'boolean', default: false })
  canCreate: boolean;

  @Column({ type: 'varchar', length: 200, default: '' })
  updatedBy: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
