import {
  EMPTY_TCK_FORM,
  MAX_TCK_IMPORT_ITEMS,
  NO_TCK_DISTRICT,
  NO_TCK_DISTRICT_LABEL,
} from '../constants/tck.constants';
import type { Tck, TckFilter } from '../interfaces/dictionary.interface';
import type { SelectOption } from '../interfaces/ui.interface';
import type { TckForm, TckImportFile, TckImportItem } from '../interfaces/organization.interface';

export function tckToForm(t: Tck | null): TckForm {
  if (!t) return { ...EMPTY_TCK_FORM };
  return {
    name: t.name,
    nameGenitive: t.nameGenitive,
    address: t.address,
    postalCode: t.postalCode ?? '',
    phone: t.phone,
    email: t.email,
    region: t.region ?? '',
    district: t.district ?? '',
    city: t.city ?? '',
  };
}

/** Text of a TCK export file → items to import. Throws with a readable message. */
export function parseTckImport(text: string): TckImportItem[] {
  const data: unknown = JSON.parse(text);
  const raw = Array.isArray(data) ? data : (data as TckImportFile).items;
  if (!Array.isArray(raw)) throw new Error('У файлі немає переліку ТЦК (items)');
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const items: TckImportItem[] = raw
    .map((r: Record<string, unknown>) => {
      const item: TckImportItem = { name: str(r?.['name']) };
      for (const k of [
        'nameGenitive',
        'address',
        'postalCode',
        'phone',
        'email',
        'region',
        'district',
        'city',
      ] as const) {
        const v = str(r?.[k]);
        if (v) item[k] = v;
      }
      return item;
    })
    .filter((i) => i.name);
  if (!items.length) throw new Error('У файлі немає жодного ТЦК');
  if (items.length > MAX_TCK_IMPORT_ITEMS)
    throw new Error(`Не більше ${MAX_TCK_IMPORT_ITEMS} записів за раз`);
  return items;
}

const uaSort = (a: string, b: string) => a.localeCompare(b, 'uk');
/** «м. Броди» → «Броди», so towns sort by name, not by «м.» / «смт». */
const bare = (city: string) => city.replace(/^(м\.|смт|с\.|селище)\s*/u, '');

/** Does a TCK pass the filters (region, town, district, text in the name / address / place)? */
export function tckMatches(t: Tck, f: TckFilter): boolean {
  if (f.region && t.region !== f.region) return false;
  if (f.city && t.city !== f.city) return false;
  if (f.district && (f.district === NO_TCK_DISTRICT ? !!t.district : t.district !== f.district))
    return false;
  const q = f.query.trim().toLowerCase();
  if (!q) return true;
  return [t.name, t.address, t.city, t.district, t.region].some((v) =>
    v?.toLowerCase().includes(q),
  );
}

/** Options of a place filter with the number of TCK in each («Львівська область — 26»). */
export function tckPlaceOptions(
  tcks: readonly Tck[],
  key: 'region' | 'city' | 'district',
): SelectOption[] {
  const counts = new Map<string, number>();
  for (const t of tcks) {
    const value = t[key] || (key === 'district' ? NO_TCK_DISTRICT : '');
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const sortKey = key === 'city' ? bare : (v: string) => v;
  return [...counts]
    .sort(([a], [b]) =>
      a === NO_TCK_DISTRICT ? -1 : b === NO_TCK_DISTRICT ? 1 : uaSort(sortKey(a), sortKey(b)),
    )
    .map(([value, n]) => ({
      value,
      label: value === NO_TCK_DISTRICT ? NO_TCK_DISTRICT_LABEL : value,
      hint: `${n} ТЦК`,
    }));
}

/** «м. Броди · Золочівський район · Львівська область» — the place of a TCK in one line. */
export function tckPlaceText(t: Pick<Tck, 'region' | 'district' | 'city'>): string {
  return [t.city, t.district, t.city === t.region ? '' : t.region].filter(Boolean).join(' · ');
}

/** «Золочівський район · Львівська область» — the second line under the town in the directory. */
export function tckPlaceDetails(t: Pick<Tck, 'region' | 'district' | 'city'>): string {
  return [t.district, t.city === t.region ? '' : t.region].filter(Boolean).join(' · ');
}

/** A TCK in a picker: the place as the second line — so it is found by town, district or region too. */
export function tckOption(t: Tck): SelectOption {
  return { value: t.id, label: t.name, hint: tckPlaceText(t) };
}
