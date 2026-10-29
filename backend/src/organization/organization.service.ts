import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { addDays, type IsoDate, todayIso } from '../common/utils/dates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  CreateOrganizationHeadDto,
  CreateResponsiblePersonDto,
  UpdateOrganizationDto,
  UpdateOrganizationHeadDto,
  UpdateResponsiblePersonDto,
} from './organization.dto.js';
import { OrganizationHead } from './organization-head.entity.js';
import { Organization } from './organization.entity.js';
import { ResponsiblePerson } from './responsible-person.entity.js';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    @InjectRepository(ResponsiblePerson) private readonly personRepo: Repository<ResponsiblePerson>,
    @InjectRepository(OrganizationHead) private readonly headRepo: Repository<OrganizationHead>,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Company details as of a date: the head (director) is the one whose period covers the date —
   * documents dated before a change of director keep the previous director.
   */
  async getAt(date: IsoDate): Promise<Organization> {
    const [org, head] = await Promise.all([this.get(), this.headAt(date)]);
    return head ? { ...org, headPosition: head.position, headName: head.fullName } : org;
  }

  listHeads() {
    return this.headRepo.find({ order: { validFrom: 'DESC' } });
  }

  async headAt(date: IsoDate): Promise<OrganizationHead | null> {
    const candidates = await this.headRepo.find({
      where: [
        { validFrom: LessThanOrEqual(date), validTo: IsNull() },
        { validFrom: LessThanOrEqual(date), validTo: MoreThanOrEqual(date) },
      ],
      order: { validFrom: 'DESC' },
    });
    return candidates[0] ?? null;
  }

  /** New head: the previous open period is closed the day before; users are notified by e-mail. */
  async createHead(dto: CreateOrganizationHeadDto) {
    const open = await this.headRepo.find({ where: { validTo: IsNull() } });
    for (const h of open) {
      if (h.validFrom < dto.validFrom) {
        h.validTo = addDays(dto.validFrom, -1);
        await this.headRepo.save(h);
      }
    }
    const head = await this.headRepo.save(this.headRepo.create({ ...dto, validTo: dto.validTo || null }));
    await this.syncCurrentHead();
    await this.notifications.notifyUsers(
      'Зміна керівника підприємства',
      `З ${dto.validFrom.split('-').reverse().join('.')} документи з військового обліку підписує ${dto.position} ${dto.fullName}.`,
    );
    return head;
  }

  async updateHead(id: string, dto: UpdateOrganizationHeadDto) {
    const head = await this.headRepo.findOneBy({ id });
    if (!head) throw new NotFoundException();
    Object.assign(head, dto);
    if (head.validTo === '') head.validTo = null;
    await this.headRepo.save(head);
    await this.syncCurrentHead();
    return head;
  }

  async removeHead(id: string) {
    await this.headRepo.delete(id);
    await this.syncCurrentHead();
  }

  /** organization.headName / headPosition always show the head as of today. */
  private async syncCurrentHead() {
    const head = await this.headAt(todayIso());
    if (!head) return;
    const org = await this.get();
    org.headName = head.fullName;
    org.headPosition = head.position;
    await this.orgRepo.save(org);
  }

  async get(): Promise<Organization> {
    const org = await this.orgRepo.findOneBy({ id: 1 });
    if (org) return org;
    return this.orgRepo.save(this.orgRepo.create({ id: 1 }));
  }

  async update(dto: UpdateOrganizationDto) {
    const org = await this.get();
    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  listResponsible() {
    return this.personRepo.find({ order: { validFrom: 'DESC' } });
  }

  createResponsible(dto: CreateResponsiblePersonDto) {
    return this.personRepo.save(this.personRepo.create({ ...dto, validTo: dto.validTo || null }));
  }

  async updateResponsible(id: string, dto: UpdateResponsiblePersonDto) {
    const person = await this.personRepo.findOneBy({ id });
    if (!person) throw new NotFoundException();
    Object.assign(person, dto);
    if (person.validTo === '') person.validTo = null;
    return this.personRepo.save(person);
  }

  async removeResponsible(id: string) {
    await this.personRepo.delete(id);
  }

  /** Responsible person whose period covers the date (logic of OCL!Q20:S28). */
  async responsibleAt(date: IsoDate): Promise<ResponsiblePerson | null> {
    const candidates = await this.personRepo.find({
      where: [
        { validFrom: LessThanOrEqual(date), validTo: IsNull() },
        { validFrom: LessThanOrEqual(date), validTo: MoreThanOrEqual(date) },
      ],
      order: { validFrom: 'DESC' },
    });
    return candidates[0] ?? null;
  }
}
