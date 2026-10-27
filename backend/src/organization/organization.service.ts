import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import type { IsoDate } from '../common/utils/dates.js';
import type {
  CreateResponsiblePersonDto,
  UpdateOrganizationDto,
  UpdateResponsiblePersonDto,
} from './organization.dto.js';
import { Organization } from './organization.entity.js';
import { ResponsiblePerson } from './responsible-person.entity.js';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    @InjectRepository(ResponsiblePerson) private readonly personRepo: Repository<ResponsiblePerson>,
  ) {}

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
