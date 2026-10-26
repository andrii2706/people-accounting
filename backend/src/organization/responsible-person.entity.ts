import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Особа, відповідальна за ведення військового обліку (аркуш Authorized).
 * На документи підставляється та, чий період дії охоплює дату документа.
 */
@Entity('responsible_persons')
export class ResponsiblePerson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ініціали та прізвище. */
  @Column({ type: 'varchar', length: 200 })
  fullName: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  position: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  phone: string;

  /** Номер наказу про призначення. */
  @Column({ type: 'varchar', length: 50, default: '' })
  orderNumber: string;

  @Column({ type: 'date' })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
