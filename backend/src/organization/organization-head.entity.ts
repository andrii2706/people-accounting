import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Head of the company (director) for a period. Documents are signed by the head
 * whose period covers the document date — after a change of director old letters keep the old name.
 */
@Entity('organization_heads')
export class OrganizationHead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  position: string;

  /** Name and SURNAME as in the signature. */
  @Column({ type: 'varchar', length: 200 })
  fullName: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  orderNumber: string;

  @Column({ type: 'date' })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
