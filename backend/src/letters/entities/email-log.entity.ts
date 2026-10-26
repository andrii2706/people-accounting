import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_log')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  letterId: string | null;

  @Column({ type: 'varchar', length: 500 })
  to: string;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'jsonb', default: [] })
  attachments: string[];

  /** SENT | FAILED */
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  messageId: string;

  @Column({ type: 'text', default: '' })
  error: string;

  @Column({ type: 'uuid', nullable: true })
  sentById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
