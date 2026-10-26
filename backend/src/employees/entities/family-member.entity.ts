import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import type { FamilyRelation } from '../../military/dictionaries.js';
import { Employee } from './employee.entity.js';

@Entity('family_members')
export class FamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (e) => e.familyMembers, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee>;

  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({ type: 'varchar', length: 20 })
  relation: FamilyRelation;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  middleName: string;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;
}
