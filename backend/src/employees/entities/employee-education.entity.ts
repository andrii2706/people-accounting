import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Employee } from './employee.entity.js';

/**
 * Education of an employee — there can be several (school, college, university, second degree…).
 * The highest level is mirrored into educationLevel / educationSpecialty / … of the card.
 */
@Entity('employee_educations')
export class EmployeeEducation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (e) => e.educations, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee>;

  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Level from the dictionary: «Повна вища освіта», «Базова вища освіта» … */
  @Column({ type: 'varchar', length: 100, default: '' })
  level: string;

  /** Educational institution. */
  @Column({ type: 'varchar', length: 300, default: '' })
  institution: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  specialty: string;

  /** Name, series and number of the education document. */
  @Column({ type: 'varchar', length: 300, default: '' })
  document: string;

  @Column({ type: 'date', nullable: true })
  documentDate: string | null;
}
