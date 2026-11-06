import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { fieldErrors } from '../common/validators/validators.js';
import { loadEnv } from '../config/env.js';
import { todayIso } from '../common/utils/dates.utils.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { normalizePhone } from '../military/employee-rules.js';
import { Organization } from '../organization/organization.entity.js';
import { OrganizationService } from '../organization/organization.service.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type { Scope } from '../shared/interfaces/auth.interface.js';
import type { EnvelopeLabel, ResponsibleInfo } from '../shared/interfaces/document.interface.js';
import type {
  EntityCountRow,
  LegalEntitySummary,
  TckUsageRow,
  RegistryCompany,
} from '../shared/interfaces/legal-entity.interface.js';
import { REGISTRY_SOURCE_LABEL, REGISTRY_TIMEOUT_MS } from './legal-entities.constants.js';
import type { CreateLegalEntityDto, UpdateLegalEntityDto } from './legal-entities.dto.js';
import { LegalEntity } from './legal-entity.entity.js';
import { User } from '../users/user.entity.js';
import { pickRegistryCompany, toRegistryCompany } from './utils/registry.utils.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { SAMPLE_RECIPIENT } from '../documents/label-settings.constants.js';
import { senderParty, tckParty } from '../documents/utils/label-party.utils.js';
import { labelSettingsProblems, withLabelDefaults } from '../documents/utils/label-settings.utils.js';
import type { LabelSettings } from '../shared/interfaces/label-settings.interface.js';
import { entityQuota, quotaStanding } from './utils/quota.utils.js';

/** Legal entities of the client: requisites, the head and the person responsible for military registration. */
@Injectable()
export class LegalEntitiesService {
  private readonly env = loadEnv();

  constructor(
    @InjectRepository(LegalEntity) private readonly repo: Repository<LegalEntity>,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    private readonly org: OrganizationService,
  ) {}

  async list(date: IsoDate = todayIso(), scope: Scope = null): Promise<LegalEntitySummary[]> {
    const own = scope ? { legalEntityId: scope } : {};
    const [entities, counts, staff] = await Promise.all([
      this.all(scope),
      // all employees, the dismissed too: an entity with any of them cannot be deleted
      this.employees
        .createQueryBuilder('e')
        .select('e.legalEntityId', 'legalEntityId')
        .addSelect('COUNT(*)', 'count')
        .where(scope ? 'e.legalEntityId = :scope' : '1=1', { scope })
        .groupBy('e.legalEntityId')
        .getRawMany<EntityCountRow>(),
      this.employees.find({ where: own }),
    ]);
    const allById = new Map(counts.map((c) => [c.legalEntityId, Number(c.count)]));
    const standing = staff.map((e) => quotaStanding(e, date));
    return entities.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      shortName: e.shortName,
      edrpou: e.edrpou,
      headPosition: e.headPosition,
      headName: e.headName,
      responsibleName: e.responsibleName,
      responsiblePosition: e.responsiblePosition,
      headUserId: e.headUserId,
      responsibleUserId: e.responsibleUserId,
      employees: standing.filter((s) => s.employed && s.legalEntityId === e.id).length,
      allEmployees: allById.get(e.id) ?? 0,
      quota: entityQuota(e, standing),
    }));
  }

  /** Legal entities by name: all, or only the one of the scope. */
  all(scope: string | null = null): Promise<LegalEntity[]> {
    return this.repo.find({ where: scope ? { id: scope } : {}, order: { fullName: 'ASC' } });
  }

  async get(id: string): Promise<LegalEntity> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Юридичну особу не знайдено');
    return entity;
  }

  async create(dto: CreateLegalEntityDto): Promise<LegalEntity> {
    await this.assertUniqueCode(dto.edrpou);
    return this.repo.save(this.repo.create(this.clean(dto)));
  }

  async update(id: string, dto: UpdateLegalEntityDto): Promise<LegalEntity> {
    const entity = await this.get(id);
    if (dto.edrpou && dto.edrpou !== entity.edrpou) await this.assertUniqueCode(dto.edrpou);
    Object.assign(entity, this.clean(dto));
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    const count = await this.employees.countBy({ legalEntityId: id });
    if (count) {
      throw new BadRequestException(
        `У цій юридичній особі ${count} працівник(ів), разом зі звільненими — спершу переведіть їх в іншу юрособу`,
      );
    }
    await this.repo.delete(id);
  }

  /**
   * The legal entity of a new employee: the given one, or the only one there is.
   * With several legal entities the choice is required.
   */
  async resolveForEmployee(id: string | null | undefined): Promise<string> {
    if (id) return (await this.get(id)).id;
    const all = await this.repo.find({ select: { id: true }, take: 2 });
    if (all.length === 1) return all[0].id;
    throw fieldErrors([
      {
        field: 'legalEntityId',
        message: all.length ? 'Оберіть юридичну особу' : 'Спершу додайте юридичну особу в «Налаштування»',
      },
    ]);
  }

  /**
   * The legal entity a document is formed for: the given one, or the only one there is.
   * With several legal entities a document needs an explicit choice.
   */
  async forDocument(id: string | null | undefined): Promise<string | null> {
    if (id) return (await this.get(id)).id;
    const all = await this.repo.find({ select: { id: true }, take: 2 });
    if (all.length > 1) throw new BadRequestException('Оберіть юридичну особу, для якої формується документ');
    return all[0]?.id ?? null;
  }

  /** Requisites for the documents: the legal entity + the global settings of the system. */
  async requisites(id: string | null): Promise<Organization> {
    const [settings, entity] = await Promise.all([this.org.get(), id ? this.repo.findOneBy({ id }) : this.single()]);
    if (!entity) return settings;
    return {
      ...settings,
      fullName: entity.fullName,
      nameLocative: entity.nameLocative,
      shortName: entity.shortName,
      edrpou: entity.edrpou,
      address: entity.address,
      postalCode: entity.postalCode,
      phone: entity.phone,
      email: entity.email,
      letterNumberPrefix: entity.letterNumberPrefix,
      headPosition: entity.headPosition,
      headName: entity.headName,
    };
  }

  /** The executor in the documents of the legal entity. */
  async responsible(id: string | null): Promise<ResponsibleInfo | null> {
    const entity = id ? await this.repo.findOneBy({ id }) : await this.single();
    if (!entity?.responsibleName) return null;
    return { fullName: entity.responsibleName, position: entity.responsiblePosition, phone: entity.responsiblePhone };
  }

  /** Label settings of the legal entity (the defaults when none are saved, or for documents without an entity). */
  async labelSettings(id: string | null): Promise<LabelSettings> {
    const entity = id ? await this.repo.findOneBy({ id }) : await this.single();
    return withLabelDefaults(entity?.labelSettings);
  }

  /** Saves the label settings when they fit on the paper; the settings before and after — for the journal. */
  async saveLabelSettings(id: string, dto: LabelSettings): Promise<{ before: LabelSettings; after: LabelSettings }> {
    const entity = await this.get(id);
    const before = withLabelDefaults(entity.labelSettings);
    const after = withLabelDefaults(dto);
    const problems = labelSettingsProblems(after);
    if (problems.length) throw fieldErrors(problems, 'LabelSettingsDto');
    entity.labelSettings = after;
    await this.repo.save(entity);
    return { before, after };
  }

  /**
   * A label of this legal entity for the preview: the sender — its requisites,
   * the recipient — the TCK where most of its employees are registered (a sample TCK when none).
   */
  async sampleLabel(id: string): Promise<EnvelopeLabel> {
    const [org, top] = await Promise.all([
      this.requisites(id),
      this.employees
        .createQueryBuilder('e')
        .select('e.tckId', 'tckId')
        .where('e.legalEntityId = :id AND e.tckId IS NOT NULL', { id })
        .groupBy('e.tckId')
        .orderBy('COUNT(*)', 'DESC')
        .limit(1)
        .getRawOne<TckUsageRow>(),
    ]);
    const tck = top ? await this.repo.manager.findOneBy(Tck, { id: top.tckId }) : null;
    return { sender: senderParty(org), recipient: tck ? tckParty(tck) : { ...SAMPLE_RECIPIENT } };
  }

  /** The legal entity of the account (the letters about its password name it). */
  async entityOfUser(userId: string): Promise<{ name: string; code: string } | null> {
    const user = await this.repo.manager.findOne(User, {
      where: { id: userId },
      select: { id: true, legalEntityId: true },
    });
    const e = user?.legalEntityId ? await this.repo.findOneBy({ id: user.legalEntityId }) : null;
    if (e) return { name: e.shortName || e.fullName, code: e.edrpou };
    const all = await this.repo.find({ take: 2 });
    return all.length === 1 ? { name: all[0].shortName || all[0].fullName, code: all[0].edrpou } : null;
  }

  /** Extra reminder addresses: of one legal entity, or of all of them (null). */
  async notifyEmails(id: string | null): Promise<string[]> {
    const entities = id ? await this.repo.findBy({ id }) : await this.repo.find();
    return [
      ...new Set(
        entities.flatMap((e) =>
          e.notifyEmails
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ),
    ];
  }

  /** Company data from the free ЄДР service — to fill the form; the user checks and saves. */
  async lookup(code: string): Promise<RegistryCompany> {
    const template = this.env.companyRegistryUrl;
    if (!template) throw new ServiceUnavailableException('Пошук у реєстрі вимкнено (COMPANY_REGISTRY_URL)');
    let body: unknown;
    try {
      const res = await fetch(template.replace('{code}', encodeURIComponent(code)), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
      });
      if (res.status === 404) body = null;
      else if (!res.ok) throw new Error(`HTTP ${res.status}`);
      else body = await res.json();
    } catch {
      throw new BadGatewayException('Реєстр не відповідає — спробуйте пізніше або заповніть вручну');
    }
    const raw = pickRegistryCompany(body);
    if (!raw) throw new NotFoundException(`Компанію з кодом ${code} у реєстрі не знайдено`);
    return toRegistryCompany(raw, code, REGISTRY_SOURCE_LABEL);
  }

  private async single(): Promise<LegalEntity | null> {
    const all = await this.repo.find({ take: 2, order: { createdAt: 'ASC' } });
    return all.length ? all[0] : null;
  }

  private async assertUniqueCode(edrpou: string) {
    if (await this.repo.existsBy({ edrpou })) {
      throw fieldErrors([{ field: 'edrpou', message: 'Юридична особа з таким кодом уже є' }]);
    }
  }

  private clean<T extends Partial<CreateLegalEntityDto>>(dto: T): T {
    const out = { ...dto };
    for (const key of Object.keys(out) as (keyof T)[]) {
      if (typeof out[key] === 'string') out[key] = (out[key] as string).trim() as T[keyof T];
    }
    if (out.phone !== undefined) out.phone = normalizePhone(out.phone);
    if (out.responsiblePhone !== undefined) out.responsiblePhone = normalizePhone(out.responsiblePhone);
    return out;
  }
}
