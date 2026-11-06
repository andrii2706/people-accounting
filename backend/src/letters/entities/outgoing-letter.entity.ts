import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { LegalEntity } from '../../legal-entities/legal-entity.entity.js';
import { Tck } from '../../dictionaries/tck.entity.js';
import { EmployeeChange } from '../../employees/entities/employee-change.entity.js';
import { Employee } from '../../employees/entities/employee.entity.js';
import type { LetterType, LetterStatus } from '../../shared/interfaces/letter.interface.js';

/** Register of outgoing military-registration correspondence. */
@Entity('outgoing_letters')
/** Number in the register: unique per legal entity and year (an expression index — see migration EntityRoles). */
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

  /** Sender: the legal entity whose requisites, head and responsible person are in the document. */
  @ManyToOne(() => LegalEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'legalEntityId' })
  legalEntity: Relation<LegalEntity> | null;

  @Column({ type: 'uuid', nullable: true })
  legalEntityId: string | null;

  /** A notice sent before the system (entered by hand): no generated document. */
  @Column({ type: 'boolean', default: false })
  external: boolean;

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
