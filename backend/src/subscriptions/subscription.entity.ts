import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type { PlanCode } from '../shared/interfaces/subscription.interface.js';

/** The subscription of a legal entity that signed up itself (one per legal entity). */
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  legalEntityId: string;

  /** Who chose the plan (the director who signed up). */
  @Column({ type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ type: 'varchar', length: 20 })
  plan: PlanCode;

  /** Free access until this day inclusive. */
  @Column({ type: 'date' })
  trialUntil: IsoDate;

  /** Paid access until this day inclusive; null — nothing paid yet. */
  @Column({ type: 'date', nullable: true })
  paidUntil: IsoDate | null;

  /** Enterprise: when the request was left and what the client wrote. */
  @Column({ type: 'timestamptz', nullable: true })
  enterpriseRequestedAt: Date | null;

  @Column({ type: 'varchar', length: 1000, default: '' })
  enterpriseNote: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
