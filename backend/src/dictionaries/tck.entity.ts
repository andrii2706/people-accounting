import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Territorial recruitment and social support centre (EDU_TCK!A24:C49). */
@Entity('tck')
export class Tck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300, unique: true })
  name: string;

  /** Name in the genitive case for «Керівнику …» (e.g. «Шевченківського РТЦК та СП»). Falls back to name when empty. */
  @Column({ type: 'varchar', length: 300, default: '' })
  nameGenitive: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  address: string;

  /** Postal code for envelope labels. */
  @Column({ type: 'varchar', length: 10, default: '' })
  postalCode: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  phone: string;

  /** Contact e-mail of the TCK (reference only — the app does not send e-mails). */
  @Column({ type: 'varchar', length: 200, default: '' })
  email: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
