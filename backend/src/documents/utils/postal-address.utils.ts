import { POSTAL_ADDRESS_PATTERNS } from '../documents.constants.js';

type Kind = 'street' | 'building' | 'locality' | 'district' | 'region' | 'country' | 'other';

function kindOf(part: string): Kind {
  const p = POSTAL_ADDRESS_PATTERNS;
  if (p.region.test(part)) return 'region';
  if (p.district.test(part)) return 'district';
  if (p.country.test(part)) return 'country';
  if (p.locality.test(part)) return 'locality';
  if (p.street.test(part)) return 'street';
  if (p.building.test(part)) return 'building';
  return 'other';
}

/**
 * An address in the order the Rules of postal services ask (cl. 32): the street with the building and the
 * apartment / office, then the settlement, the district, the region — one per line; the index goes apart.
 * «79007, м. Львів, вул. Батуринська, 2» → [«вул. Батуринська, 2», «м. Львів»].
 * An address it cannot read (no street, no settlement) stays as it was, one line.
 */
export function postalAddressParts(address: string, postalCode = ''): string[] {
  const parts = address
    .split(/\s*[,;]\s*/)
    .map((x) => x.trim())
    .filter((x) => x && x !== postalCode && !/^\d{5}$/.test(x));
  const kinds = parts.map(kindOf);
  if (!kinds.includes('street') && !kinds.includes('locality')) return parts.length ? [parts.join(', ')] : [];

  const street: string[] = [];
  const place: Record<'locality' | 'district' | 'region', string[]> = { locality: [], district: [], region: [] };
  const rest: string[] = [];
  let afterStreet = false;
  parts.forEach((part, i) => {
    const kind = kinds[i];
    if (kind === 'street') {
      street.push(part);
      afterStreet = true;
    } else if (kind === 'building' || (kind === 'other' && afterStreet)) {
      // the number of the house, «кв. 5», «оф. 3», «корп. 2» — they belong to the street
      street.push(part);
    } else if (kind === 'locality' || kind === 'district' || kind === 'region') {
      place[kind].push(part);
      afterStreet = false;
    } else if (kind !== 'country') {
      rest.push(part);
    }
  });
  return [street.join(', '), ...rest, ...place.locality, ...place.district, ...place.region].filter(Boolean);
}

/** The lines of the address with the index as the last one — «Куди» of form 107 and other one-line uses. */
export function postalAddressLines(address: string, postalCode = ''): string[] {
  const code = postalCode.trim() || (/(?:^|\D)(\d{5})(?:\D|$)/.exec(address)?.[1] ?? '');
  return [...postalAddressParts(address, code), ...(code ? [code] : [])];
}
