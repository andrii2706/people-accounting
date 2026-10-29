import {
  BeforeInsert,
  BeforeUpdate,
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
import { blindIndex, encrypted } from '../../common/crypto/field-encryption.js';
import { Tck } from '../../dictionaries/tck.entity.js';
import type { MaritalStatus } from '../../military/dictionaries.js';
import { EmployeePosition } from './employee-position.entity.js';
import { FamilyMember } from './family-member.entity.js';
import { MilitaryDocument } from './military-document.entity.js';

/**
 * Employee card. Corresponds to one sheet 01–21 of the Excel file,
 * but stores the current state; the history of changes lives in employee_changes and audit_log.
 */
@Entity('employees')
@Index(['lastName', 'firstName'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ---------- Personal data ----------
  @Column({ type: 'varchar', length: 30, default: '' })
  personnelNumber: string;

  @Column({ type: 'varchar', length: 1 })
  gender: 'M' | 'F';

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  middleName: string;

  /** RNOKPP (taxpayer number). Stored encrypted (AES-256-GCM). */
  @Column({ type: 'text', default: '', transformer: encrypted })
  rnokpp: string;

  /** HMAC of RNOKPP — for exact search without decryption. */
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  rnokppHash: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 50, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  email: string;

  /** Declared (registered) place of residence. */
  @Column({ type: 'varchar', length: 500, default: '' })
  registeredAddress: string;

  /** Actual place of residence (same as registered when empty). */
  @Column({ type: 'varchar', length: 500, default: '' })
  actualAddress: string;

  // ---------- Passports ----------
  /** ID_CARD | BOOK */
  @Column({ type: 'varchar', length: 10, default: 'ID_CARD' })
  passportType: 'ID_CARD' | 'BOOK';

  @Column({ type: 'varchar', length: 10, default: '' })
  passportSeries: string;

  @Column({ type: 'text', default: '', transformer: encrypted })
  passportNumber: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  passportIssuedBy: string;

  @Column({ type: 'date', nullable: true })
  passportIssuedAt: string | null;

  @Column({ type: 'varchar', length: 10, default: '' })
  foreignPassportSeries: string;

  @Column({ type: 'text', default: '', transformer: encrypted })
  foreignPassportNumber: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  foreignPassportIssuedBy: string;

  @Column({ type: 'date', nullable: true })
  foreignPassportIssuedAt: string | null;

  @Column({ type: 'date', nullable: true })
  foreignPassportValidUntil: string | null;

  // ---------- Education ----------
  @Column({ type: 'varchar', length: 100, default: '' })
  educationLevel: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  educationSpecialty: string;

  /** Name, series and number of the education document. */
  @Column({ type: 'varchar', length: 300, default: '' })
  educationDocument: string;

  @Column({ type: 'date', nullable: true })
  educationDocumentDate: string | null;

  // ---------- Family ----------
  @Column({ type: 'varchar', length: 20, nullable: true })
  maritalStatus: MaritalStatus | null;

  @OneToMany(() => FamilyMember, (m) => m.employee, { cascade: true })
  familyMembers: Relation<FamilyMember[]>;

  // ---------- Employment ----------
  /** Positions in the company (appointment and transfers); the latest one is mirrored in position / department / positionSince / positionOrder. */
  @OneToMany(() => EmployeePosition, (p) => p.employee, { cascade: true, eager: true })
  positions: Relation<EmployeePosition[]>;

  @Column({ type: 'varchar', length: 300, default: '' })
  position: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  department: string;

  /** Details of the order appointing to the current position (order No., date). */
  @Column({ type: 'varchar', length: 300, default: '' })
  positionOrder: string;

  @Column({ type: 'date', nullable: true })
  positionSince: string | null;

  @Column({ type: 'date', nullable: true })
  hireDate: string | null;

  /** Name of the document on taking the position: «наказ», «розпорядження» … */
  @Column({ type: 'varchar', length: 100, default: '' })
  hireOrderDocName: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  hireOrderNumber: string;

  @Column({ type: 'date', nullable: true })
  hireOrderDate: string | null;

  @Index()
  @Column({ type: 'date', nullable: true })
  dismissalDate: string | null;

  @Column({ type: 'varchar', length: 100, default: '' })
  dismissalOrderDocName: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  dismissalOrderNumber: string;

  @Column({ type: 'date', nullable: true })
  dismissalOrderDate: string | null;

  // ---------- Military registration ----------
  @Column({ type: 'boolean', default: true })
  militaryRegistered: boolean;

  /** Record number in the Unified State Register of conscripts, persons liable for military service and reservists. */
  @Column({ type: 'text', default: '', transformer: encrypted })
  registryNumber: string;

  /** Rank code 0–22 (0 — conscript). */
  @Column({ type: 'int', nullable: true })
  rankCode: number | null;

  /** Navy ranks. */
  @Column({ type: 'boolean', default: false })
  navy: boolean;

  /** Military occupational specialty (officers — 6 characters, others — 3). */
  @Column({ type: 'varchar', length: 20, default: '' })
  vos: string;

  /** Training profile (for officers). */
  @Column({ type: 'varchar', length: 200, default: '' })
  trainingProfile: string;

  /** Reserve category (1/2) or grade for officers. */
  @Column({ type: 'varchar', length: 20, default: '' })
  accountingCategory: string;

  /** Military registration documents — there may be several. */
  @OneToMany(() => MilitaryDocument, (d) => d.employee, { cascade: true, eager: true })
  militaryDocuments: Relation<MilitaryDocument[]>;

  /** Has served in the armed forces (column 15 «Відомості про проходження військової служби»). */
  @Column({ type: 'boolean', default: false })
  servedInArmy: boolean;

  @ManyToOne(() => Tck, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tckId' })
  tck: Relation<Tck> | null;

  @Column({ type: 'uuid', nullable: true })
  tckId: string | null;

  @Column({ type: 'date', nullable: true })
  tckRegisteredAt: string | null;

  /** Fitness for military service. */
  @Column({ type: 'varchar', length: 300, default: '' })
  fitness: string;

  /** Column and item of the order (military medical commission decision). */
  @Column({ type: 'varchar', length: 200, default: '' })
  fitnessBasis: string;

  @Column({ type: 'date', nullable: true })
  fitnessDate: string | null;

  /**
   * Reserved («заброньований») — chosen explicitly in the form. The reservation data below
   * is kept and shown only when this is true.
   */
  @Column({ type: 'boolean', default: false })
  reserved: boolean;

  /** Reservation: item, section and number of the list. */
  @Column({ type: 'varchar', length: 500, default: '' })
  reservationBasis: string;

  /** Special registration certificate number. */
  @Column({ type: 'varchar', length: 100, default: '' })
  specialAccountingCertificate: string;

  @Column({ type: 'date', nullable: true })
  reservationUntil: string | null;

  /** Who reserved the employee: this company (counts towards its quota) or another legal entity. */
  @Column({ type: 'varchar', length: 10, default: 'COMPANY' })
  reservedBy: 'COMPANY' | 'OTHER';

  @Column({ type: 'varchar', length: 300, default: '' })
  reservedByName: string;

  @Column({ type: 'varchar', length: 10, default: '' })
  reservedByEdrpou: string;

  /** Deferral from conscript service (provision of the Law «Про військовий обов’язок і військову службу»). */
  @Column({ type: 'varchar', length: 500, default: '' })
  deferralConscriptionBasis: string;

  /** Deferral from mobilization (provision of the Law «Про мобілізаційну підготовку та мобілізацію»). */
  @Column({ type: 'varchar', length: 500, default: '' })
  deferralMobilizationBasis: string;

  @Column({ type: 'date', nullable: true })
  deferralUntil: string | null;

  /** Deferral «до завершення мобілізації» (instead of a fixed date; the end comes from the latest decree). */
  @Column({ type: 'boolean', default: false })
  deferralUntilMobilizationEnd: boolean;

  /** Service in the reserve — team number. Present ⇒ reservist. */
  @Column({ type: 'varchar', length: 100, default: '' })
  reserveTeamNumber: string;

  @Column({ type: 'date', nullable: true })
  mobilizationOrderDate: string | null;

  /** Information on military service. */
  @Column({ type: 'text', default: '' })
  militaryServiceInfo: string;

  @Column({ type: 'date', nullable: true })
  mobilizedAt: string | null;

  @Column({ type: 'varchar', length: 50, default: '' })
  mobilizationReleaseOrder: string;

  @Column({ type: 'date', nullable: true })
  demobilizedAt: string | null;

  @Column({ type: 'varchar', length: 50, default: '' })
  readmissionOrder: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  protected updateSearchIndexes() {
    if (this.rnokpp !== undefined) this.rnokppHash = blindIndex(this.rnokpp);
  }
}
