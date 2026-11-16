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
import { LegalEntity } from '../../legal-entities/legal-entity.entity.js';
import type { IsoDate } from '../../shared/interfaces/common.interface.js';
import type { ListSection } from '../../shared/interfaces/dictionary.interface.js';
import type { ListRowView } from '../../shared/interfaces/report.interface.js';

/**
 * Lists formed by a user on a date («Сформувати»): the rows as they were — the page and the documents
 * show exactly them, until the lists are formed again.
 */
@Entity('list_snapshots')
@Index('IDX_list_snapshots_entity_created', ['legalEntityId', 'createdAt'])
export class ListSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LegalEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legalEntityId' })
  legalEntity: Relation<LegalEntity>;

  @Column({ type: 'uuid' })
  legalEntityId: string;

  /** «Станом на». */
  @Column({ type: 'date' })
  date: IsoDate;

  @Column({ type: 'jsonb' })
  rows: ListRowView[];

  @Column({ type: 'int' })
  total: number;

  @Column({ type: 'jsonb' })
  sections: Record<ListSection, number>;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  createdByName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
