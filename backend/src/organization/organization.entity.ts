import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Реквізити підприємства (аркуш G). Один запис з id = 1. */
@Entity('organization')
export class Organization {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  /** «Товариство з обмеженою відповідальністю «…»» */
  @Column({ type: 'varchar', length: 500, default: '' })
  fullName: string;

  /** Місцевий відмінок: «Товаристві з обмеженою відповідальністю «…»» — для «які працюють в …». */
  @Column({ type: 'varchar', length: 500, default: '' })
  nameLocative: string;

  /** «ТзОВ «…»» */
  @Column({ type: 'varchar', length: 300, default: '' })
  shortName: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  edrpou: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  address: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  email: string;

  /** Посада керівника для підпису («Директор»). */
  @Column({ type: 'varchar', length: 200, default: 'Директор' })
  headPosition: string;

  /** Ініціали та прізвище керівника («І. ПРІЗВИЩЕ»). */
  @Column({ type: 'varchar', length: 200, default: '' })
  headName: string;

  /** Префікс вихідного номера листа, напр. «ВО-». */
  @Column({ type: 'varchar', length: 30, default: '' })
  letterNumberPrefix: string;

  /** За скільки днів попереджати про завершення бронювання/відстрочки. */
  @Column({ type: 'int', default: 30 })
  alertDays: number;

  /** Строк повідомлення ТЦК про зміни, днів. */
  @Column({ type: 'int', default: 7 })
  notifyDeadlineDays: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
