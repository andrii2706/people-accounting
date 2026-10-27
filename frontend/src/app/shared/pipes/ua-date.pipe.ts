import { Pipe, type PipeTransform } from '@angular/core';

/** ISO `YYYY-MM-DD` (or date-time) → `dd.mm.yyyy`. No Intl, so SSR and the browser produce the same result. */
@Pipe({ name: 'uaDate' })
export class UaDatePipe implements PipeTransform {
  transform(value: string | null | undefined, empty = '—'): string {
    if (!value) return empty;
    const [y, m, d] = value.slice(0, 10).split('-');
    return d && m && y ? `${d}.${m}.${y}` : empty;
  }
}
