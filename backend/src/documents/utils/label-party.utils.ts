import type { Tck } from '../../dictionaries/tck.entity.js';
import type { Organization } from '../../organization/organization.entity.js';
import type { LabelParty } from '../../shared/interfaces/document.interface.js';
import { postalCodeOf } from '../builders.js';
import { stripPostalCode } from './label-settings.utils.js';

/** A party of a label: the index taken out of the address, so that it is printed only once. */
function party(name: string, address: string, postalCode: string | null | undefined, phone: string): LabelParty {
  const code = postalCodeOf(postalCode, address);
  return { name, address: stripPostalCode(address ?? '', code), postalCode: code, phone };
}

/** The sender on a label: the legal entity (short name, if any). */
export function senderParty(org: Organization): LabelParty {
  return party(org.shortName || org.fullName, org.address, org.postalCode, org.phone);
}

/** The recipient on a label: the TCK of the letter. */
export function tckParty(tck: Tck | null | undefined): LabelParty {
  return party(tck?.name ?? '', tck?.address ?? '', tck?.postalCode, tck?.phone ?? '');
}
