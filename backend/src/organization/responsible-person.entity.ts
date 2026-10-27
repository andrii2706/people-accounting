import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Person responsible for military registration (sheet Authorized).
 * Documents use the one whose period covers the document date.
 */
@Entity('responsible_persons')
export class ResponsiblePerson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Initials and surname. */
  @Column({ type: 'varchar', length: 200 })
  fullName: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  position: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  phone: string;

  /** Number of the appointment order. */
  @Column({ type: 'varchar', length: 50, default: '' })
  orderNumber: string;

  @Column({ type: 'date' })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
