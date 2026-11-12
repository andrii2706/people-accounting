import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UpdateOrganizationDto } from './organization.dto.js';
import { Organization } from './organization.entity.js';

/**
 * System settings: one row (id = 1). The requisites of the companies are in the legal entities;
 * the requisite columns of this row are kept only for older data and are not used by documents.
 */
@Injectable()
export class OrganizationService {
  constructor(@InjectRepository(Organization) private readonly orgRepo: Repository<Organization>) {}

  async get(): Promise<Organization> {
    const org = await this.orgRepo.findOneBy({ id: 1 });
    if (org) return org;
    return this.orgRepo.save(this.orgRepo.create({ id: 1 }));
  }

  async update(dto: UpdateOrganizationDto) {
    const org = await this.get();
    const before = org.mobilizationUntil;
    Object.assign(org, dto);
    // a date changed by hand is a confirmed one (the same date sent with other settings changes nothing)
    if (dto.mobilizationUntil !== undefined && dto.mobilizationUntil !== before) {
      org.mobilizationConfirmedUntil = dto.mobilizationUntil;
      org.mobilizationEstimated = false;
    }
    return this.orgRepo.save(org);
  }
}
