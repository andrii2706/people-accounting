import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { fieldErrors } from '../common/validators/validators.js';
import { normalizePhone } from '../military/employee-rules.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type {
  EntityPerson,
  GrantAccessResult,
  PersonAccess,
  RevokeAccessResult,
} from '../shared/interfaces/legal-entity.interface.js';
import { UsersService } from '../users/users.service.js';
import { PERSON_AS_WHOM, PERSON_FIELDS, PERSON_LABELS } from './legal-entities.constants.js';
import type { ChangePersonDto, GrantAccessDto } from './legal-entities.dto.js';
import { LegalEntity } from './legal-entity.entity.js';
import { accessOf, personOf } from './utils/person.utils.js';

/**
 * System access of the head and the responsible person of a legal entity — the main administrator, or the
 * administrator / director of this legal entity:
 * give an account (login = their e-mail, a temporary password is shown once), turn it off, replace the person.
 */
@Injectable()
export class LegalEntityAccessService {
  constructor(
    @InjectRepository(LegalEntity) private readonly repo: Repository<LegalEntity>,
    private readonly users: UsersService,
  ) {}

  private async entity(id: string) {
    const entity = await this.repo.findOne({ where: { id }, relations: { headUser: true, responsibleUser: true } });
    if (!entity) throw new NotFoundException('Юридичну особу не знайдено');
    return entity;
  }

  /** The accounts of the head and of the responsible person (the legal entity card). */
  async people(id: string): Promise<Record<EntityPerson, PersonAccess | null>> {
    const entity = await this.entity(id);
    return { HEAD: accessOf(entity.headUser), RESPONSIBLE: accessOf(entity.responsibleUser) };
  }

  async grant(id: string, person: EntityPerson, dto: GrantAccessDto, actor: AuthUser): Promise<GrantAccessResult> {
    const entity = await this.entity(id);
    const { name, userId } = personOf(entity, person);
    if (!name.trim()) {
      throw new BadRequestException(`Спершу вкажіть і збережіть ПІБ ${PERSON_LABELS[person]}`);
    }
    if (userId) throw new BadRequestException(`У ${PERSON_LABELS[person]} вже є доступ — спершу скасуйте його`);

    const existing = await this.users.findByEmail(dto.email);
    let access: PersonAccess;
    let temporaryPassword: string | null = null;
    let mailSent = false;
    let expiresAt: Date | null = null;
    if (existing) {
      // an account with this e-mail already exists — link it (and turn it back on), the password stays
      if (existing.role === 'VENDOR' || existing.role === 'ADMIN') {
        throw fieldErrors([{ field: 'email', message: 'Цю адресу не можна використати' }]);
      }
      // one person — one legal entity: an account of another legal entity cannot be linked here
      if (existing.legalEntityId && existing.legalEntityId !== id) {
        throw fieldErrors([{ field: 'email', message: 'Ця адреса вже використовується в іншій юридичній особі' }]);
      }
      if (!existing.legalEntityId) await this.users.assignEntity(existing.id, id);
      access = accessOf(existing)!;
      if (!existing.isActive) {
        access = accessOf(await this.users.update(existing.id, { isActive: true }, existing.id))!;
      }
    } else {
      const created = await this.users.createWithTemporaryPassword(
        dto.email,
        name.trim(),
        dto.role ?? (person === 'HEAD' ? 'DIRECTOR' : 'HR'),
        actor,
        {
          entityName: entity.shortName || entity.fullName,
          entityCode: entity.edrpou,
          asWhom: PERSON_AS_WHOM[person],
          legalEntityId: id,
        },
      );
      access = accessOf(created.user)!;
      temporaryPassword = created.temporaryPassword;
      mailSent = created.mailSent;
      expiresAt = created.expiresAt;
    }
    await this.repo.update(id, { [PERSON_FIELDS[person].userId]: access.userId });
    return { access, temporaryPassword, mailSent, expiresAt };
  }

  /**
   * Turns the access off: the account is deactivated (not deleted — the audit log keeps its actions),
   * the sessions end at once. An account still linked to another legal entity is only unlinked here.
   */
  async revoke(id: string, person: EntityPerson, actor: AuthUser): Promise<RevokeAccessResult> {
    const entity = await this.entity(id);
    const user = person === 'HEAD' ? entity.headUser : entity.responsibleUser;
    if (!user) throw new NotFoundException(`У ${PERSON_LABELS[person]} немає доступу`);
    if (user.id === actor.id) throw new BadRequestException('Не можна скасувати власний доступ');
    await this.repo.update(id, { [PERSON_FIELDS[person].userId]: null });
    const elsewhere = await this.repo
      .createQueryBuilder('e')
      .where('(e.headUserId = :uid OR e.responsibleUserId = :uid)', { uid: user.id })
      .getExists();
    if (elsewhere) return { deactivated: false, email: user.email };
    if (user.isActive) await this.users.update(user.id, { isActive: false }, actor.id);
    return { deactivated: true, email: user.email };
  }

  /** A new head / responsible person: the details are replaced; the previous access can be turned off. */
  /**
   * The director has added his legal entity: from now on his account belongs to it and he is its head
   * (the head's access is his account).
   */
  async adoptByDirector(id: string, director: AuthUser) {
    await this.users.assignEntity(director.id, id);
    const entity = await this.entity(id);
    if (!entity.headUserId) {
      await this.repo.update(id, { headUserId: director.id, headName: entity.headName.trim() || director.fullName });
    }
  }

  async change(id: string, person: EntityPerson, dto: ChangePersonDto, actor: AuthUser) {
    const entity = await this.entity(id);
    const f = PERSON_FIELDS[person];
    let revoked: RevokeAccessResult | null = null;
    if (entity[f.userId] && dto.revokePrevious) revoked = await this.revoke(id, person, actor);

    const changes: Partial<LegalEntity> = { [f.name]: dto.fullName.trim(), [f.userId]: null };
    if (dto.position !== undefined) changes[f.position] = dto.position.trim();
    if (f.phone && dto.phone !== undefined) changes[f.phone] = normalizePhone(dto.phone);
    await this.repo.update(id, changes);

    const granted = dto.email ? await this.grant(id, person, { email: dto.email, role: dto.role }, actor) : null;
    return { revoked, granted };
  }
}
