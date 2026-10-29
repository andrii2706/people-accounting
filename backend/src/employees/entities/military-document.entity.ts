import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { encrypted } from '../../common/crypto/field-encryption.js';
import { Employee } from './employee.entity.js';

/**
 * Military registration document of an employee (військовий квиток, тимчасове посвідчення,
 * е-ВОД з «Резерв+» …). An employee may have several — all of them go into column 9 of the lists.
 */
@Entity('military_documents')
export class MilitaryDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (e) => e.militaryDocuments, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'employeeId' })
  employee: Relation<Employee>;

  @Column({ type: 'uuid' })
  employeeId: string;

  /** Order in the form and in the documents. */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 150, default: '' })
  type: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  series: string;

  @Column({ type: 'text', default: '', transformer: encrypted })
  number: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  issuedBy: string;

  @Column({ type: 'date', nullable: true })
  issuedAt: string | null;

  /** Electronic document (Reserve+): date and time it was generated — separate fields. */
  @Column({ type: 'date', nullable: true })
  generatedDate: string | null;

  /** HH:MM */
  @Column({ type: 'varchar', length: 5, default: '' })
  generatedTime: string;
}
