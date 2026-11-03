import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { User } from '../users/user.entity.js';

/** «Read» marks of in-app notifications, per user. The notifications themselves are computed from the data. */
@Entity('inbox_reads')
export class InboxRead {
  @PrimaryColumn('uuid')
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 200 })
  key: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @CreateDateColumn({ type: 'timestamptz' })
  readAt: Date;
}
