import type { ListQuickFilter, ListRow, TckNameParts } from '../interfaces/report.interface';
import { COL } from '../constants/lists.constants';

export function matchesQuickFilter(row: ListRow, filter: ListQuickFilter): boolean {
  const s = row.status;
  switch (filter) {
    case 'RESERVED':
      return s.reserved;
    case 'DEFERRAL':
      return s.deferral;
    case 'MOBILIZATION_ORDER':
      return s.mobilizationOrder;
    case 'PENDING':
      return s.pendingNotices > 0;
    case 'WARNINGS':
      return s.warnings > 0;
  }
}

const compact = (text: string) => text.toLowerCase().replace(/[\s'’ʼ-]/g, '');

/** Search by name, taxpayer number or VOS; spaces, apostrophes and case are ignored. */
export function matchesSearch(row: ListRow, query: string): boolean {
  const q = compact(query);
  if (!q) return true;
  return [COL.name, COL.taxNumber, COL.vos].some((i) => compact(row.cells[i] ?? '').includes(q));
}

export function filterRows(
  rows: readonly ListRow[],
  query: string,
  filters: ReadonlySet<ListQuickFilter>,
): ListRow[] {
  return rows.filter(
    (r) => matchesSearch(r, query) && [...filters].every((f) => matchesQuickFilter(r, f)),
  );
}

/** «3569…553» — the full number is in the expanded row; passport numbers stay as they are. */
export function maskTaxNumber(value: string): string {
  return /^\d{10}$/.test(value) ? `${value.slice(0, 4)}…${value.slice(-3)}` : value;
}

/** «Сихівський РТЦК та СП (м. Львів)» → name «Сихівський РТЦК», place «м. Львів». */
export function splitTck(name: string): TckNameParts {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(name.trim());
  const base = (m ? m[1] : name).replace(/\s+та\s+СП$/u, '').trim();
  return { name: base, place: m ? m[2] : '' };
}
