import { CITY_REGIONS, REGION_OF_CENTRE } from '../dictionaries.constants.js';
import type { TckPlace } from '../../shared/interfaces/dictionary.interface.js';

const SETTLEMENT = String.raw`(м\.|смт|с\.|сел\.|селище|село)\s*([^,()]+?)`;

/** «смт  Петриківка» → «смт Петриківка», «село Х» → «с. Х», «сел. Х» → «селище Х» (as written in the source). */
function settlement(kind: string, name: string): string {
  const prefix = kind === 'село' ? 'с.' : kind === 'сел.' ? 'селище' : kind;
  return `${prefix} ${name.trim().replace(/\s+/g, ' ')}`;
}

/** The town of a TCK: from the name «… (м. Броди)», otherwise from the address. */
export function tckCity(name: string, address: string): string {
  const inName = new RegExp(String.raw`\(\s*${SETTLEMENT}\s*\)`, 'u').exec(name);
  if (inName) return settlement(inName[1], inName[2]);
  const inAddress = new RegExp(String.raw`(?:^|,)\s*${SETTLEMENT}\s*(?:,|$)`, 'u').exec(address);
  return inAddress ? settlement(inAddress[1], inAddress[2]) : '';
}

/**
 * The district a TCK serves: «Шевченківський РТЦК» → «Шевченківський район», «І відділ Золочівського РТЦК» →
 * «Золочівський район». Regional (ОТЦК) and city (МТЦК, ОМТЦК) centres serve no single district → ''.
 */
export function tckDistrict(name: string): string {
  const clean = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const dept = /^(?:[0-9IVХІ]+\s+)?відділ\s+(\S+?)ого\s+(?:О?Р)ТЦК/iu.exec(clean);
  if (dept) return `${dept[1]}ий район`;
  const own = /^(\S+?(?:ий|ій))\s+(?:О?Р)ТЦК/u.exec(clean);
  return own ? `${own[1]} район` : '';
}

/** The region: the known one (directory data); «Вінницька обл.» in the address → «Вінницька область»; Київ / Севастополь; the regional centre. */
export function tckRegion(address: string, city: string, hint = ''): string {
  if (hint) return hint;
  const inAddress = /([А-ЯІЇЄҐ][А-ЯІЇЄҐа-яіїєґ’'-]+)\s+(?:обл\.|область)/u.exec(address);
  if (inAddress) return `${inAddress[1]} область`;
  if (/Автономна Республіка Крим|АР Крим/u.test(address)) return 'Автономна Республіка Крим';
  const cityRegion = CITY_REGIONS.find((c) => c === city);
  if (cityRegion) return cityRegion;
  return REGION_OF_CENTRE[city.replace(/^м\.\s*/u, '')] ?? '';
}

/** Region, district and town of a TCK from its name and address (the filters of the directory). */
export function tckPlace(t: { name: string; address?: string }, regionHint = ''): TckPlace {
  const address = t.address ?? '';
  const city = tckCity(t.name, address);
  return { region: tckRegion(address, city, regionHint), district: tckDistrict(t.name), city };
}

/** Fills only the empty place fields — what was typed by hand stays. */
export function withPlace<T extends { name: string; address?: string } & Partial<TckPlace>>(t: T, regionHint = ''): T {
  const place = tckPlace(t, regionHint);
  return {
    ...t,
    region: t.region?.trim() || place.region,
    district: t.district?.trim() || place.district,
    city: t.city?.trim() || place.city,
  };
}
