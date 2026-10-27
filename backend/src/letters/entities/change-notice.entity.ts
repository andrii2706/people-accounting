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
import { encrypted } from '../../common/crypto/field-encryption.js';
import { EmployeeChange } from '../../employees/entities/employee-change.entity.js';
import { Employee } from '../../employees/entities/employee.entity.js';
import type { ChangeType } from '../../military/dictionaries.js';
import { OutgoingLetter } from './outgoing-letter.entity.js';

/**
 * A single notice about a change of registration data (Annex 4 to the Procedure) sent to the TCK.
 *
 * Stores a snapshot of what was actually written in the notice, so the history stays correct
 * even after the employee card changes. The snapshot contains personal data (registry number,
 * addresses, documents), therefore it is stored encrypted (AES-256-GCM).
 */
@Entity('change_notices')
@Index(['letterId', 'sequence'], { unique: true })
export class ChangeNotice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => OutgoingLetter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'letterId' })
  letter: Relation<OutgoingLetter>;

  @Column({ type: 'uuid' })
  letterId: string;

  /** Position of the notice inside the letter (1, 2, …) — forms the notice number "<letter>/<n>". */
  @Column({ type: 'int' })
  sequence: number;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee> | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  employeeId: string | null;

  @ManyToOne(() => EmployeeChange, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changeId' })
  change: Relation<EmployeeChange> | null;

  @Column({ type: 'uuid', nullable: true })
  changeId: string | null;

  /** Kept in plain text for lists and search (the same as in the employees table). */
  @Column({ type: 'varchar', length: 300 })
  employeeName: string;

  @Column({ type: 'varchar', length: 30 })
  changeType: ChangeType;

  @Column({ type: 'date' })
  effectiveDate: string;

  /** JSON of NoticeSnapshot, encrypted. */
  @Column({ type: 'text', transformer: encrypted })
  content: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
