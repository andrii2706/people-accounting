import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { SecurityEventKind, SecurityLevel } from '../../shared/interfaces/security.interface.js';

/**
 * The security journal: what looks like a break-in or a leak (a locked account, a wrong code after the right
 * password, a new device, too many downloads, a file with a script). Without personal data of employees.
 */
@Entity('security_events')
@Index('IDX_security_events_entity', ['legalEntityId', 'createdAt'])
@Index('IDX_security_events_kind', ['kind', 'createdAt'])
@Index('IDX_security_events_user', ['userId', 'createdAt'])
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  kind: SecurityEventKind;

  @Column({ type: 'varchar', length: 10, default: 'WARN' })
  level: SecurityLevel;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  userName: string;

  /** Whose administrators see it; null — only the main administrator. */
  @Column({ type: 'uuid', nullable: true })
  legalEntityId: string | null;

  @Column({ type: 'varchar', length: 64, default: '' })
  ip: string;

  /** «Chrome · Windows». */
  @Column({ type: 'varchar', length: 120, default: '' })
  device: string;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, string | number | boolean>;

  /** An e-mail alert was sent about it. */
  @Column({ type: 'boolean', default: false })
  notified: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
