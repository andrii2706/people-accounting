import type { HrBatchCounts } from '../interfaces/hr-sync.interface';

/** «нових 3 · змін 5 · звільнень 1» — what a delivery brings (or brought). */
export function hrCountsText(c: HrBatchCounts): string {
  const parts = [
    c.create ? `нових ${c.create}` : '',
    c.update ? `змін ${c.update}` : '',
    c.dismiss ? `звільнень ${c.dismiss}` : '',
    c.conflict ? `розбіжностей ${c.conflict}` : '',
    c.error ? `помилок ${c.error}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'змін немає';
}

/** ISO time → «18.11.2026 07:05» in Kyiv time, the same on the server render and in the browser. */
export function hrBatchTime(iso: string | null): string {
  if (!iso) return '—';
  const parts = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}
