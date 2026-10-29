import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Employee } from './employee.entity.js';

/**
 * Positions (places of work) of an employee in the company: appointment and every transfer.
 * The latest one is the current position (column 17 of the lists: position and the order).
 */
@Entity('employee_positions')
export class EmployeePosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (e) => e.positions, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee>;

  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({ type: 'varchar', length: 300 })
  position: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  department: string;

  @Column({ type: 'date', nullable: true })
  since: string | null;

  /** Name of the appointing document: «наказ», «розпорядження» … */
  @Column({ type: 'varchar', length: 100, default: '' })
  orderDocName: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  orderNumber: string;

  @Column({ type: 'date', nullable: true })
  orderDate: string | null;
}
