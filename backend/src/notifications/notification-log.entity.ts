import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Sent e-mail notifications — so the daily job never sends the same reminder twice. */
@Entity('notification_log')
@Index(['kind', 'refId', 'refDate'], { unique: true })
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** DEFERRAL_ENDING, RESERVATION_ENDING, MOBILIZATION_EXTENDED, MOBILIZATION_ENDING … */
  @Column({ type: 'varchar', length: 40 })
  kind: string;

  /** Employee / other object the reminder is about (NIL uuid for global ones). */
  @Column({ type: 'uuid' })
  refId: string;

  /** The date the reminder is about (e.g. the deferral end). */
  @Column({ type: 'date' })
  refDate: string;

  @Column({ type: 'int', default: 0 })
  recipients: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
