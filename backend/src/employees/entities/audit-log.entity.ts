import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Audit log of actions with personal data: who changed what and when. */
@Entity('audit_log')
@Index(['entity', 'entityId'])
@Index('IDX_audit_log_user_action', ['userId', 'action', 'createdAt'])
@Index('IDX_audit_log_action_time', ['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  entity: string;

  @Column({ type: 'uuid' })
  entityId: string;

  /** CREATE | UPDATE | DELETE | DISMISS | EXPORT | SEND */
  @Column({ type: 'varchar', length: 20 })
  action: string;

  /** { field: [old, new] } */
  @Column({ type: 'jsonb', default: {} })
  diff: Record<string, [unknown, unknown]>;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  userName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
