import type { Tck } from '../../dictionaries/tck.entity.js';
import type { Organization } from '../../organization/organization.entity.js';
import type { LabelParty, ResponsibleInfo } from '../../shared/interfaces/document.interface.js';
import { postalCodeOf } from '../builders.js';
import { postalAddressParts } from './postal-address.utils.js';
import { stripPostalCode } from './label-settings.utils.js';

/**
 * A party of a label as the Rules of postal services ask (cl. 32): the name, the street with the house, the
 * settlement, the district, the region, the index (once, taken out of the address), the phone.
 */
function party(name: string, address: string, postalCode: string | null | undefined, phone: string): LabelParty {
  const code = postalCodeOf(postalCode, address);
  const addressLines = postalAddressParts(stripPostalCode(address ?? '', code), code);
  return { name, address: addressLines.join(', '), addressLines, postalCode: code, phone };
}

/**
 * The sender on a label: the legal entity by its full name (the Rules ask the full name of a legal entity). Its phone — of the legal entity, otherwise of the
 * person responsible for military registration (the TCK calls the one who sent the letter).
 */
export function senderParty(org: Organization, responsible?: ResponsibleInfo | null): LabelParty {
  return party(org.fullName || org.shortName, org.address, org.postalCode, org.phone || responsible?.phone || '');
}

/** The recipient on a label: the TCK of the letter. */
export function tckParty(tck: Tck | null | undefined): LabelParty {
  return party(tck?.name ?? '', tck?.address ?? '', tck?.postalCode, tck?.phone ?? '');
}
