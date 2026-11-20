import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** The browsers an account has signed in from: a sign-in from a new one is reported to the person. */
@Entity('user_devices')
@Index('IDX_user_devices_user_hash', ['userId', 'deviceHash'], { unique: true })
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** SHA-256 of the account and the random id in the device cookie (the id itself is not stored). */
  @Column({ type: 'varchar', length: 64 })
  deviceHash: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  label: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  lastIp: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  firstSeenAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSeenAt: Date;
}
