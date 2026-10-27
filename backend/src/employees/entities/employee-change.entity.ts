import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { ChangeType } from '../../military/dictionaries.js';
import { OutgoingLetter } from '../../letters/entities/outgoing-letter.entity.js';
import { Employee } from './employee.entity.js';

/**
 * A change of registration data the TCK must be notified about (Annex 4 to the Procedure).
 * While letterId is empty the change is "awaiting notice".
 */
@Entity('employee_changes')
@Index(['employeeId', 'effectiveDate'])
export class EmployeeChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee>;

  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({ type: 'varchar', length: 30 })
  type: ChangeType;

  @Column({ type: 'text', default: '' })
  oldValue: string;

  @Column({ type: 'text', default: '' })
  newValue: string;

  /** Date from which the change takes effect. */
  @Column({ type: 'date' })
  effectiveDate: string;

  /** Grounds: name of the document, number and date of issue. */
  @Column({ type: 'text', default: '' })
  basis: string;

  @ManyToOne(() => OutgoingLetter, (l) => l.changes, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'letterId' })
  letter: Relation<OutgoingLetter> | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  letterId: string | null;

  /** Mark "do not notify" (e.g. a data entry mistake). */
  @Column({ type: 'boolean', default: false })
  skipped: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
