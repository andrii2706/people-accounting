import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service.js';
import { assertInScope } from '../../common/utils/entity-scope.utils.js';
import { LegalEntitiesService } from '../../legal-entities/legal-entities.service.js';
import { LIST_SECTIONS } from '../../military/dictionaries.js';
import type { AuthUser, Scope } from '../../shared/interfaces/auth.interface.js';
import type { IsoDate } from '../../shared/interfaces/common.interface.js';
import type { ListSection } from '../../shared/interfaces/dictionary.interface.js';
import type {
  ListSnapshotDocument,
  ListSnapshotReport,
  ListSnapshotSummary,
} from '../../shared/interfaces/list-settings.interface.js';
import { ReportsService } from '../reports.service.js';
import { ListSnapshot } from './list-snapshot.entity.js';
import { LIST_SNAPSHOTS_SHOWN } from './lists.constants.js';

const NOT_FOUND = 'Сформовані списки не знайдено';

/** «Сформувати» — the lists of a legal entity on a date, kept as they were. */
@Injectable()
export class ListSnapshotsService {
  constructor(
    @InjectRepository(ListSnapshot) private readonly snapshots: Repository<ListSnapshot>,
    private readonly reports: ReportsService,
    private readonly legalEntities: LegalEntitiesService,
    private readonly audit: AuditService,
  ) {}

  private summary(s: ListSnapshot): ListSnapshotSummary {
    return {
      id: s.id,
      legalEntityId: s.legalEntityId,
      date: s.date,
      total: s.total,
      sections: s.sections,
      createdAt: s.createdAt,
      createdByName: s.createdByName,
    };
  }

  /** The history of a legal entity: the latest first. */
  async list(legalEntityId: string | null): Promise<ListSnapshotSummary[]> {
    // several legal entities and none chosen — nothing to show until one is chosen
    const entityId = legalEntityId
      ? await this.legalEntities.forDocument(legalEntityId)
      : await this.legalEntities.forDocument(null).catch(() => null);
    if (!entityId) return [];
    const rows = await this.snapshots.find({
      where: { legalEntityId: entityId },
      select: {
        id: true,
        legalEntityId: true,
        date: true,
        total: true,
        sections: true,
        createdAt: true,
        createdByName: true,
      },
      order: { createdAt: 'DESC' },
      take: LIST_SNAPSHOTS_SHOWN,
    });
    return rows.map((s) => this.summary(s));
  }

  async create(date: IsoDate, legalEntityId: string | null, user: AuthUser): Promise<ListSnapshotSummary> {
    const entityId = await this.legalEntities.forDocument(legalEntityId);
    if (!entityId) throw new BadRequestException('Спершу додайте юридичну особу');
    const report = await this.reports.lists(date, { legalEntityId: entityId });
    const sections = Object.fromEntries(LIST_SECTIONS.map((s) => [s, 0])) as Record<ListSection, number>;
    for (const row of report.rows) sections[row.section]++;
    const saved = await this.snapshots.save(
      this.snapshots.create({
        legalEntityId: entityId,
        date,
        rows: report.rows,
        total: report.rows.length,
        sections,
        createdById: user.id,
        createdByName: user.fullName.slice(0, 200),
      }),
    );
    await this.audit.log('list-snapshot', saved.id, 'CREATE', { date: [null, date], total: [null, saved.total] }, user);
    return this.summary(saved);
  }

  /** The formed lists for the page — in the shape of the live report. */
  async get(id: string, scope: Scope): Promise<ListSnapshotReport> {
    const s = await this.load(id, scope);
    const counts = { LIABLE: 0, RESERVIST: 0, CONSCRIPT: 0 };
    for (const row of s.rows) if (row.category) counts[row.category]++;
    return { date: s.date, rows: s.rows, counts, snapshot: this.summary(s) };
  }

  async document(id: string, scope: Scope, section: ListSection | null, user: AuthUser): Promise<ListSnapshotDocument> {
    const s = await this.load(id, scope);
    await this.audit.log(
      'report',
      s.id,
      'EXPORT',
      { lists: [null, `${s.date} ${section ?? 'all'} (сформовані)`] },
      user,
    );
    const doc = await this.reports.listsDocx(s.date, { legalEntityId: s.legalEntityId, rows: s.rows, section });
    return { ...doc, date: s.date };
  }

  async remove(id: string, scope: Scope, user: AuthUser) {
    const s = await this.load(id, scope);
    await this.snapshots.delete(s.id);
    await this.audit.log('list-snapshot', s.id, 'DELETE', { date: [s.date, null], total: [s.total, null] }, user);
  }

  /** The rows of formed lists for an outgoing letter (the letter prints exactly them). */
  async rowsFor(id: string, legalEntityId: string | null) {
    const s = await this.snapshots.findOneBy({ id });
    if (!s || (legalEntityId && s.legalEntityId !== legalEntityId)) throw new NotFoundException(NOT_FOUND);
    return s;
  }

  private async load(id: string, scope: Scope): Promise<ListSnapshot> {
    const s = await this.snapshots.findOneBy({ id });
    if (!s) throw new NotFoundException(NOT_FOUND);
    assertInScope(scope, s.legalEntityId, NOT_FOUND);
    return s;
  }
}
