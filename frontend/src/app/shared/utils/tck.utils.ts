import { EMPTY_TCK_FORM, MAX_TCK_IMPORT_ITEMS } from '../constants/tck.constants';
import type { Tck } from '../interfaces/dictionary.interface';
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
      for (const k of ['nameGenitive', 'address', 'postalCode', 'phone', 'email'] as const) {
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
