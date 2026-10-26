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
import { FamilyMember } from './family-member.entity.js';

/**
 * Картка працівника. Відповідає одному аркушу 01–21 файлу Excel,
 * але зберігає поточний стан; історія змін — у employee_changes та audit_log.
 */
@Entity('employees')
@Index(['lastName', 'firstName'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ---------- Особисті дані ----------
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

  /** РНОКПП (ІПН). Зберігається зашифрованим (AES-256-GCM). */
  @Column({ type: 'text', default: '', transformer: encrypted })
  rnokpp: string;

  /** HMAC від РНОКПП — для точного пошуку без розшифрування. */
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  rnokppHash: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 50, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  email: string;

  /** Адреса задекларованого (зареєстрованого) місця проживання. */
  @Column({ type: 'varchar', length: 500, default: '' })
  registeredAddress: string;

  /** Адреса фактичного місця проживання (якщо порожньо — як зареєстрована). */
  @Column({ type: 'varchar', length: 500, default: '' })
  actualAddress: string;

  // ---------- Паспорти ----------
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

  // ---------- Освіта ----------
  @Column({ type: 'varchar', length: 100, default: '' })
  educationLevel: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  educationSpecialty: string;

  /** Назва, серія, номер документа про освіту. */
  @Column({ type: 'varchar', length: 300, default: '' })
  educationDocument: string;

  @Column({ type: 'date', nullable: true })
  educationDocumentDate: string | null;

  // ---------- Сім'я ----------
  @Column({ type: 'varchar', length: 20, nullable: true })
  maritalStatus: MaritalStatus | null;

  @OneToMany(() => FamilyMember, (m) => m.employee, { cascade: true })
  familyMembers: Relation<FamilyMember[]>;

  // ---------- Робота ----------
  @Column({ type: 'varchar', length: 300, default: '' })
  position: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  department: string;

  /** Реквізити акта про призначення на поточну посаду (наказ № від). */
  @Column({ type: 'varchar', length: 300, default: '' })
  positionOrder: string;

  @Column({ type: 'date', nullable: true })
  positionSince: string | null;

  @Column({ type: 'date', nullable: true })
  hireDate: string | null;

  @Column({ type: 'varchar', length: 50, default: '' })
  hireOrderNumber: string;

  @Column({ type: 'date', nullable: true })
  hireOrderDate: string | null;

  @Index()
  @Column({ type: 'date', nullable: true })
  dismissalDate: string | null;

  @Column({ type: 'varchar', length: 50, default: '' })
  dismissalOrderNumber: string;

  @Column({ type: 'date', nullable: true })
  dismissalOrderDate: string | null;

  // ---------- Військовий облік ----------
  @Column({ type: 'boolean', default: true })
  militaryRegistered: boolean;

  /** Реєстраційний номер облікового запису в ЄДР призовників, військовозобов’язаних та резервістів. */
  @Column({ type: 'text', default: '', transformer: encrypted })
  registryNumber: string;

  /** Код звання 0–22 (0 — призовник). */
  @Column({ type: 'int', nullable: true })
  rankCode: number | null;

  /** Корабельні звання. */
  @Column({ type: 'boolean', default: false })
  navy: boolean;

  /** ВОС (офіцери — 6 символів, інші — 3). */
  @Column({ type: 'varchar', length: 20, default: '' })
  vos: string;

  /** Профіль підготовки (для офіцерів). */
  @Column({ type: 'varchar', length: 200, default: '' })
  trainingProfile: string;

  /** Категорія обліку (1/2) або розряд для офіцерів. */
  @Column({ type: 'varchar', length: 20, default: '' })
  accountingCategory: string;

  @Column({ type: 'varchar', length: 150, default: '' })
  militaryDocType: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  militaryDocSeries: string;

  @Column({ type: 'text', default: '', transformer: encrypted })
  militaryDocNumber: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  militaryDocIssuedBy: string;

  @Column({ type: 'date', nullable: true })
  militaryDocIssuedAt: string | null;

  /** Час та дата формування електронного ВОД (Резерв+). */
  @Column({ type: 'varchar', length: 30, default: '' })
  militaryDocGeneratedAt: string;

  @ManyToOne(() => Tck, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tckId' })
  tck: Relation<Tck> | null;

  @Column({ type: 'uuid', nullable: true })
  tckId: string | null;

  @Column({ type: 'date', nullable: true })
  tckRegisteredAt: string | null;

  /** Придатність до військової служби. */
  @Column({ type: 'varchar', length: 300, default: '' })
  fitness: string;

  /** Графа, пункт наказу (рішення ВЛК). */
  @Column({ type: 'varchar', length: 200, default: '' })
  fitnessBasis: string;

  @Column({ type: 'date', nullable: true })
  fitnessDate: string | null;

  /** Бронювання: пункт, розділ та номер переліку. */
  @Column({ type: 'varchar', length: 500, default: '' })
  reservationBasis: string;

  /** Номер посвідчення спецобліку. */
  @Column({ type: 'varchar', length: 100, default: '' })
  specialAccountingCertificate: string;

  @Column({ type: 'date', nullable: true })
  reservationUntil: string | null;

  /** Відстрочка від строкової служби (норма ЗУ «Про військовий обов’язок і військову службу»). */
  @Column({ type: 'varchar', length: 500, default: '' })
  deferralConscriptionBasis: string;

  /** Відстрочка від мобілізації (норма ЗУ «Про мобілізаційну підготовку та мобілізацію»). */
  @Column({ type: 'varchar', length: 500, default: '' })
  deferralMobilizationBasis: string;

  @Column({ type: 'date', nullable: true })
  deferralUntil: string | null;

  /** Служба в резерві — номер команди. Наявність ⇒ резервіст. */
  @Column({ type: 'varchar', length: 100, default: '' })
  reserveTeamNumber: string;

  @Column({ type: 'date', nullable: true })
  mobilizationOrderDate: string | null;

  /** Відомості про проходження військової служби. */
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
