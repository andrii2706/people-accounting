import { ODATA_EMPTY_DATE, ODATA_EMPTY_REF, ODATA_PROFILES, ODATA_SUFFIX } from '../hr-sync.constants.js';
import type { ODataProfile } from '../../shared/interfaces/hr-sync.interface.js';

/** Entity sets of a publication with their properties, read from `$metadata` (EDMX). */
export type ODataSchema = Map<string, Set<string>>;

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** The EntityTypes and their Property / NavigationProperty names. 1C names the entity set like the type. */
export function parseMetadata(xml: string): ODataSchema {
  const schema: ODataSchema = new Map();
  const typeRe = /<EntityType\b[^>]*\bName="([^"]+)"[^>]*>([\s\S]*?)<\/EntityType>/g;
  for (const m of xml.matchAll(typeRe)) {
    const props = new Set<string>();
    for (const p of m[2].matchAll(/<(?:Property|NavigationProperty)\b[^>]*\bName="([^"]+)"/g)) props.add(decode(p[1]));
    schema.set(decode(m[1]), props);
  }
  return schema;
}

/** A profile with every logical field resolved to the property the publication really has ('' — none). */
export interface ResolvedProfile {
  profile: ODataProfile;
  fields: Record<string, string>;
  hasStaff: boolean;
  hasNames: boolean;
  missing: string[];
}

/**
 * The configuration of the publication: the first profile whose employees and persons tables exist.
 * `missing` lists what is not published — shown on the check so the 1C administrator can add it.
 */
export function detectProfile(schema: ODataSchema): ResolvedProfile | null {
  for (const profile of ODATA_PROFILES) {
    if (!schema.has(profile.employees) || !schema.has(profile.persons)) continue;
    const tableOf = (logical: string) =>
      logical.startsWith('employee')
        ? profile.employees
        : logical.startsWith('staff')
          ? profile.staff
          : logical.startsWith('person')
            ? profile.persons
            : logical.startsWith('names')
              ? profile.names
              : profile.organizations;
    const fields: Record<string, string> = {};
    const missing: string[] = [];
    for (const [logical, candidates] of Object.entries(profile.fields)) {
      const table = tableOf(logical);
      const props = table ? schema.get(table) : undefined;
      fields[logical] = (props && candidates.find((c) => props.has(c))) || '';
      if (!fields[logical] && props) missing.push(`${table}.${candidates[0]}`);
    }
    for (const table of [profile.organizations, profile.positions, profile.departments, profile.staff, profile.names]) {
      if (table && !schema.has(table)) missing.push(table);
    }
    return {
      profile,
      fields,
      hasStaff: !!profile.staff && schema.has(profile.staff),
      hasNames: !!profile.names && schema.has(profile.names),
      missing,
    };
  }
  return null;
}

/**
 * The address of the standard OData interface from what the user typed: the address of the publication
 * («https://1c.company.ua/zup») or the full one («…/odata/standard.odata»).
 */
export function odataBase(url: string): string {
  const clean = url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/\$metadata$/, '');
  return /\/odata\/standard\.odata$/i.test(clean) ? clean : `${clean}${ODATA_SUFFIX}`;
}

/** «2026-03-12T00:00:00» → «2026-03-12»; the empty date of 1C → ''. */
export function odataDate(value: unknown): string {
  const s = typeof value === 'string' ? value.slice(0, 10) : '';
  return !s || s === ODATA_EMPTY_DATE ? '' : s;
}

/** A reference; the empty reference of 1C → ''. */
export function odataRef(value: unknown): string {
  const s = typeof value === 'string' ? value : '';
  return s === ODATA_EMPTY_REF ? '' : s;
}

/** «Мужской», «Чоловіча», «M» → «M»; «Женский», «Жіноча» → «F». */
export function odataGender(value: unknown): string {
  const s = String(value ?? '').toLowerCase();
  if (/^(муж|чол|m)/.test(s)) return 'M';
  if (/^(жен|жін|f)/.test(s)) return 'F';
  return '';
}
