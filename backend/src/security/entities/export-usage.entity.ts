import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Every downloaded file: who, when, from where and its SHA-256. It limits the downloads per hour / day and
 * answers «who downloaded this file» when a file turns up where it should not be.
 */
@Entity('export_usage')
@Index('IDX_export_usage_user', ['userId', 'createdAt'])
@Index('IDX_export_usage_sha256', ['sha256'])
export class ExportUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  legalEntityId: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  path: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  fileName: string;

  @Column({ type: 'int', default: 0 })
  bytes: number;

  @Column({ type: 'varchar', length: 64, default: '' })
  sha256: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  ip: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
