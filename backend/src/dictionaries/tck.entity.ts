import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Територіальний центр комплектування та соціальної підтримки (EDU_TCK!A24:C49). */
@Entity('tck')
export class Tck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300, unique: true })
  name: string;

  /** Назва в родовому відмінку для «Керівнику …» (напр. «Шевченківського РТЦК та СП»). Якщо порожньо — береться name. */
  @Column({ type: 'varchar', length: 300, default: '' })
  nameGenitive: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  address: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  phone: string;

  /** Пошта для надсилання повідомлень. */
  @Column({ type: 'varchar', length: 200, default: '' })
  email: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
