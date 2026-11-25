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
import { Employee } from './employee.entity.js';
import type { HistoryField } from '../../shared/interfaces/employee.interface.js';

/**
 * When a contact, an address, the passport or the TCK of an employee changed — with the date it happened
 * (not the date it was typed in). The card shows «з …» and the earlier values from here.
 * Values are personal data: encrypted like the card itself.
 */
@Entity('employee_field_history')
@Index(['employeeId', 'field', 'effectiveDate'])
export class EmployeeFieldHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee>;

  @Column({ type: 'uuid' })
  employeeId: string;

  /** phone | email | registeredAddress | actualAddress | passport | tck */
  @Column({ type: 'varchar', length: 30 })
  field: HistoryField;

  @Column({ type: 'text', default: '', transformer: encrypted })
  oldValue: string;

  @Column({ type: 'text', default: '', transformer: encrypted })
  newValue: string;

  /** The day the new value took effect (moved, new number, new passport, registered at the TCK). */
  @Column({ type: 'date' })
  effectiveDate: string;

  /** Since when the old value was in force, if known (the TCK: «на обліку з» of the previous TCK). */
  @Column({ type: 'date', nullable: true })
  oldEffectiveDate: string | null;

  /** Grounds: the document or the statement. */
  @Column({ type: 'text', default: '' })
  basis: string;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
