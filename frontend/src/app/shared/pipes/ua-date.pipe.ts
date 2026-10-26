import { Pipe, type PipeTransform } from '@angular/core';

/** ISO `YYYY-MM-DD` (або дата-час) → `dd.mm.yyyy`. Без Intl, щоб SSR і браузер давали однаковий результат. */
@Pipe({ name: 'uaDate' })
export class UaDatePipe implements PipeTransform {
  transform(value: string | null | undefined, empty = '—'): string {
    if (!value) return empty;
    const [y, m, d] = value.slice(0, 10).split('-');
    return d && m && y ? `${d}.${m}.${y}` : empty;
  }
}
