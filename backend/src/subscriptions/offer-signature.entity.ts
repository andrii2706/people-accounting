import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import type { KepLevel } from '../shared/interfaces/kep.interface.js';
import type { OfferSignatureStatus } from '../shared/interfaces/subscription.interface.js';

/**
 * The acceptance of the offer by a legal entity: the document with the offer text and the client's details,
 * signed with the head's KEP. PENDING — offered for signing; SIGNED — the proof of the agreement.
 */
@Entity('offer_signatures')
@Index(['legalEntityId', 'termsVersion'])
export class OfferSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LegalEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legalEntityId' })
  legalEntity: Relation<LegalEntity>;

  @Column({ type: 'uuid' })
  legalEntityId: string;

  @Column({ type: 'varchar', length: 20 })
  termsVersion: string;

  /** The exact text offered for signing (UTF-8). */
  @Column({ type: 'text' })
  document: string;

  @Column({ type: 'varchar', length: 64 })
  documentSha256: string;

  @Column({ type: 'varchar', length: 10, default: 'PENDING' })
  status: OfferSignatureStatus;

  @Column({ type: 'varchar', length: 300, default: '' })
  signerName: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  signerDrfoMasked: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  signerIssuer: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  kepLevel: KepLevel | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  signatureKey: string | null;

  /** Who formed the document and who uploaded the signature (the head's KEP may be applied by an assistant). */
  @Column({ type: 'uuid', nullable: true })
  requestedByUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  signedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  signedAt: Date | null;
}
