import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import { DOCX_MIME } from '../../common/constants/mime.constants.js';
import { fieldErrors } from '../../common/validators/validators.js';
import { buildListTemplateExample } from '../../documents/builders.js';
import { LegalEntity } from '../../legal-entities/legal-entity.entity.js';
import type { ListSection } from '../../shared/interfaces/dictionary.interface.js';
import type {
  ListSectionSettings,
  ListSettings,
  ListSettingsPage,
  ListTemplateInfo,
} from '../../shared/interfaces/list-settings.interface.js';
import { StorageService } from '../../storage/storage.service.js';
import { DOCUMENT_PLACEHOLDERS, LIST_COLUMN_KEYS, ROW_PLACEHOLDERS } from './lists.constants.js';
import type { ListSectionSettingsDto } from './lists.dto.js';
import { listSectionProblems, withListDefaults } from './utils/list-settings.utils.js';
import { inspectListTemplate, ListTemplateError } from './utils/list-template.utils.js';

const ENTITY_NOT_FOUND = 'Юридичну особу не знайдено';

/** How the four lists of a legal entity look, and their Word templates. */
@Injectable()
export class ListSettingsService {
  constructor(
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly storage: StorageService,
  ) {}

  private async entity(id: string) {
    const entity = await this.entities.findOne({ where: { id }, select: { id: true, listSettings: true } });
    if (!entity) throw new NotFoundException(ENTITY_NOT_FOUND);
    return entity;
  }

  async page(id: string): Promise<ListSettingsPage> {
    return {
      settings: withListDefaults((await this.entity(id)).listSettings),
      placeholders: [
        ...DOCUMENT_PLACEHOLDERS,
        ...LIST_COLUMN_KEYS.map((k) => {
          const [tag, description] = ROW_PLACEHOLDERS[k].split(' — ');
          return { tag, description: `у {#rows}: ${description}` };
        }),
      ],
    };
  }

  /** Save one list; returns the settings before and after (for the journal). */
  async save(id: string, section: ListSection, dto: ListSectionSettingsDto) {
    const before = withListDefaults((await this.entity(id)).listSettings);
    const next: ListSectionSettings = {
      columns: dto.columns,
      sort: dto.sort,
      groupBy: dto.groupBy,
      title: dto.title,
      subtitle: dto.subtitle,
      showOutgoing: dto.showOutgoing,
      signers: dto.signers.map((x) => ({ position: x.position, name: x.name })),
      template: before[section].template,
    };
    const after = withListDefaults({ ...before, [section]: next });
    const problems = listSectionProblems(after[section]);
    if (problems.length) throw fieldErrors(problems, 'ListSectionSettingsDto');
    await this.entities.update(id, { listSettings: after });
    return { before: before[section], after: after[section], settings: after };
  }

  /** A new Word template of a list: checked, stored under a new key (the old file stays — documents are kept). */
  async uploadTemplate(id: string, section: ListSection, buffer: Buffer, fileName: string): Promise<ListSettings> {
    try {
      inspectListTemplate(buffer);
    } catch (err) {
      if (err instanceof ListTemplateError) throw new BadRequestException(err.message);
      throw err;
    }
    const settings = withListDefaults((await this.entity(id)).listSettings);
    const key = `list-templates/${id}/${section}/${randomUUID()}.docx`;
    await this.storage.put(key, buffer, DOCX_MIME);
    const template: ListTemplateInfo = {
      key,
      fileName: fileName.slice(0, 200),
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
    settings[section] = { ...settings[section], template };
    await this.entities.update(id, { listSettings: settings });
    return settings;
  }

  async removeTemplate(id: string, section: ListSection): Promise<ListSettings> {
    const settings = withListDefaults((await this.entity(id)).listSettings);
    settings[section] = { ...settings[section], template: null };
    await this.entities.update(id, { listSettings: settings });
    return settings;
  }

  async template(id: string, section: ListSection) {
    const t = withListDefaults((await this.entity(id)).listSettings)[section].template;
    if (!t) throw new NotFoundException('Для цього списку шаблон не завантажено');
    return { buffer: await this.storage.get(t.key), fileName: t.fileName };
  }

  /** A starting template with the chosen columns. */
  async example(id: string, section: ListSection) {
    const settings = withListDefaults((await this.entity(id)).listSettings);
    return buildListTemplateExample(section, settings[section].columns);
  }
}
