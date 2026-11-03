import type { ImportColumn } from '../../../shared/interfaces/import.interface.js';
import { IMPORT_COLUMNS } from '../import.constants.js';

/** Lower case, unified apostrophes, no punctuation — for comparing headers and dictionary values. */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’ʼ`'‘]/g, '’')
    .replace(/[«»"().,:;№#*]/g, ' ')
    .replace(/[\s_]+/g, ' ')
    .trim();
}

const HEADER_INDEX = new Map<string, ImportColumn>();
for (const column of IMPORT_COLUMNS) {
  for (const name of [column.header, ...(column.synonyms ?? [])]) HEADER_INDEX.set(normalizeKey(name), column);
}
// the same headers without the apostrophe ("Імя") and with the field name itself
for (const [key, column] of [...HEADER_INDEX]) HEADER_INDEX.set(key.replace(/’/g, ''), column);

export function columnForHeader(header: string): ImportColumn | undefined {
  const key = normalizeKey(header);
  return key ? (HEADER_INDEX.get(key) ?? HEADER_INDEX.get(key.replace(/’/g, ''))) : undefined;
}
