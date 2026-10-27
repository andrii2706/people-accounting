import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Tck } from '../../dictionaries/tck.entity.js';
import { EmployeeChange } from '../../employees/entities/employee-change.entity.js';
import { Employee } from '../../employees/entities/employee.entity.js';

export type LetterType = 'CHANGE_NOTICE' | 'LISTS' | 'OPERATIONAL_REPORT' | 'OTHER';
/** DRAFT — in preparation; SENT — handed over to the TCK (Ukrposhta, by hand, document management system etc.). */
export type LetterStatus = 'DRAFT' | 'SENT';

/** Register of outgoing military-registration correspondence. */
@Entity('outgoing_letters')
@Index(['year', 'sequence'], { unique: true })
export class OutgoingLetter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  sequence: number;

  /** Outgoing number as printed in the document. */
  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 30 })
  type: LetterType;

  @Column({ type: 'varchar', length: 500, default: '' })
  subject: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee> | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId: string | null;

  @ManyToOne(() => Tck, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tckId' })
  tck: Relation<Tck> | null;

  @Column({ type: 'uuid', nullable: true })
  tckId: string | null;

  @OneToMany(() => EmployeeChange, (c) => c.letter)
  changes: Relation<EmployeeChange[]>;

  /** Parameters of report letters (lists date, groups). */
  @Column({ type: 'jsonb', default: {} })
  params: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: LetterStatus;


  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  /**
   * Frozen document (.docx) that collects qualified e-signatures.
   * Once frozen, the document is never regenerated — exactly this file is downloaded.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentKey: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  documentSha256: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  documentFilename: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  documentFrozenAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
