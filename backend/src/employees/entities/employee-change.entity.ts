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
 * Зміна облікових даних, про яку треба повідомити ТЦК (Додаток 4 до Порядку).
 * Поки letterId порожній — зміна «очікує повідомлення».
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

  /** Дата, з якої діє зміна. */
  @Column({ type: 'date' })
  effectiveDate: string;

  /** Підстава: найменування документа, номер та дата видачі. */
  @Column({ type: 'text', default: '' })
  basis: string;

  @ManyToOne(() => OutgoingLetter, (l) => l.changes, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'letterId' })
  letter: Relation<OutgoingLetter> | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  letterId: string | null;

  /** Позначка «не повідомляти» (наприклад, помилкове введення). */
  @Column({ type: 'boolean', default: false })
  skipped: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
