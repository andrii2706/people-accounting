import { Pipe, type PipeTransform } from '@angular/core';
import { KYIV_DATETIME } from '../utils/date.utils';

/** Timestamp (ISO from the server, UTC) → «26.10.2026, 13:15» in Kyiv time — the same on SSR and in the browser. */
@Pipe({ name: 'uaDateTime' })
export class UaDateTimePipe implements PipeTransform {
  transform(value: string | null | undefined, empty = '—'): string {
    if (!value) return empty;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? empty : KYIV_DATETIME.format(date);
  }
}
