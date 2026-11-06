import type { Tck } from '../../dictionaries/tck.entity.js';
import type { Organization } from '../../organization/organization.entity.js';
import type { LabelParty } from '../../shared/interfaces/document.interface.js';
import { postalCodeOf } from '../builders.js';

/** The sender on a label: the legal entity (short name, if any). */
export function senderParty(org: Organization): LabelParty {
  return {
    name: org.shortName || org.fullName,
    address: org.address,
    postalCode: postalCodeOf(org.postalCode, org.address),
    phone: org.phone,
  };
}

/** The recipient on a label: the TCK of the letter. */
export function tckParty(tck: Tck | null | undefined): LabelParty {
  return {
    name: tck?.name ?? '',
    address: tck?.address ?? '',
    postalCode: postalCodeOf(tck?.postalCode, tck?.address),
    phone: tck?.phone ?? '',
  };
}
