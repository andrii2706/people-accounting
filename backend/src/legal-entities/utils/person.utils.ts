import { BadRequestException } from '@nestjs/common';
import type { User } from '../../users/user.entity.js';
import type { EntityPerson, PersonAccess } from '../../shared/interfaces/legal-entity.interface.js';
import type { LegalEntity } from '../legal-entity.entity.js';
import { PERSON_FIELDS } from '../legal-entities.constants.js';

/** «head» / «responsible» in the URL → the person. */
export function parsePerson(value: string): EntityPerson {
  const person = value.toUpperCase();
  if (person !== 'HEAD' && person !== 'RESPONSIBLE') {
    throw new BadRequestException('Невідома особа: head або responsible');
  }
  return person;
}

/** The name and the linked account of the head / the responsible person. */
export function personOf(entity: LegalEntity, person: EntityPerson) {
  const f = PERSON_FIELDS[person];
  return { name: entity[f.name], userId: entity[f.userId] };
}

export function accessOf(user: User | null | undefined): PersonAccess | null {
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    mustChangePassword: user.mustChangePassword,
  };
}
