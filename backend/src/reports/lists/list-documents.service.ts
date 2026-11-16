import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import JSZip from 'jszip';
import type { Repository } from 'typeorm';
import { formatUa } from '../../common/utils/dates.utils.js';
import { buildLists, listSubtitle, listTitle } from '../../documents/builders.js';
import { LegalEntity } from '../../legal-entities/legal-entity.entity.js';
import { LegalEntitiesService } from '../../legal-entities/legal-entities.service.js';
import { LIST_SECTION_TITLES, LIST_SECTIONS } from '../../military/dictionaries.js';
import type { ListSection } from '../../shared/interfaces/dictionary.interface.js';
import type {
  ListSectionSettings,
  ListSettings,
  ListTemplateData,
  RenderedListDocument,
} from '../../shared/interfaces/list-settings.interface.js';
import type { ListPart, ListRowView, ListsRenderRequest } from '../../shared/interfaces/report.interface.js';
import type { Organization } from '../../organization/organization.entity.js';
import { StorageService } from '../../storage/storage.service.js';
import { LIST_FILE_NAMES } from './lists.constants.js';
import { layoutList, templateGroups } from './utils/list-layout.utils.js';
import { documentSigners, withListDefaults } from './utils/list-settings.utils.js';
import { ListTemplateError, renderListTemplate } from './utils/list-template.utils.js';

/**
 * The lists as documents, by the settings of the legal entity: the built-in layout, or the Word template
 * uploaded for a list. Several lists with own templates cannot be one Word file — they come as a .zip
 * with a document per list.
 */
@Injectable()
export class ListDocumentsService {
  constructor(
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly legalEntities: LegalEntitiesService,
    private readonly storage: StorageService,
  ) {}

  async settings(legalEntityId: string | null): Promise<ListSettings> {
    const entity = legalEntityId
      ? await this.entities.findOne({ where: { id: legalEntityId }, select: { id: true, listSettings: true } })
      : null;
    return withListDefaults(entity?.listSettings);
  }

  async render(req: ListsRenderRequest): Promise<RenderedListDocument> {
    const [settings, org] = await Promise.all([
      this.settings(req.legalEntityId),
      this.legalEntities.requisites(req.legalEntityId),
    ]);
    const sections = req.section ? [req.section] : LIST_SECTIONS;
    const parts = sections.map((section) => ({ section, rows: req.rows.filter((r) => r.section === section) }));
    const filled = parts.filter((p) => p.rows.length);
    const templated = filled.filter((p) => settings[p.section].template);

    // one Word file: no own templates involved (or exactly one list, rendered by its template)
    if (req.section && settings[req.section].template) {
      return {
        buffer: await this.fromTemplate(req.section, parts[0].rows, settings[req.section], org, req),
        kind: 'docx',
      };
    }
    if (!templated.length) {
      return { buffer: await this.builtIn(parts, settings, org, req), kind: 'docx' };
    }
    const zip = new JSZip();
    for (const part of filled) {
      const s = settings[part.section];
      const buffer = s.template
        ? await this.fromTemplate(part.section, part.rows, s, org, req)
        : await this.builtIn([part], settings, org, req);
      zip.file(`${LIST_FILE_NAMES[part.section]}.docx`, buffer);
    }
    return { buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), kind: 'zip' };
  }

  private builtIn(parts: ListPart[], settings: ListSettings, org: Organization, req: ListsRenderRequest) {
    return buildLists({
      date: req.date,
      extract: req.extract,
      org,
      letter: req.letter,
      sections: parts.map((p) => ({
        section: p.section,
        layout: layoutList(p.rows, settings[p.section]),
        settings: settings[p.section],
        signers: documentSigners(settings[p.section], org.headPosition, org.headName),
      })),
    });
  }

  private async fromTemplate(
    section: ListSection,
    rows: ListRowView[],
    s: ListSectionSettings,
    org: Organization,
    req: ListsRenderRequest,
  ): Promise<Buffer> {
    const template = await this.storage.get(s.template!.key);
    const groups = templateGroups(rows, s);
    const data: ListTemplateData = {
      title: listTitle(s.title, req.extract),
      subtitle: s.subtitle.trim() || listSubtitle(section, org),
      whom: LIST_SECTION_TITLES[section],
      date: formatUa(req.date),
      outNumber: req.letter?.number ?? '',
      outDate: req.letter ? formatUa(req.letter.date) : '',
      extract: req.extract,
      org: {
        fullName: org.fullName,
        shortName: org.shortName,
        edrpou: org.edrpou,
        address: org.address,
        headPosition: org.headPosition,
        headName: org.headName,
      },
      count: rows.length,
      rows: groups.flatMap((g) => g.rows),
      groups,
      signers: documentSigners(s, org.headPosition, org.headName),
    };
    try {
      return renderListTemplate(template, data);
    } catch (err) {
      if (err instanceof ListTemplateError) {
        throw new UnprocessableEntityException(`Шаблон «${s.template!.fileName}»: ${err.message}`);
      }
      throw err;
    }
  }
}
