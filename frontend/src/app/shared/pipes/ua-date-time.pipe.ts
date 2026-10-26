import { Pipe, type PipeTransform } from '@angular/core';

const KYIV_DATETIME = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Мітка часу (ISO з сервера, UTC) → «26.10.2026, 13:15» за київським часом — однаково на SSR і в браузері. */
@Pipe({ name: 'uaDateTime' })
export class UaDateTimePipe implements PipeTransform {
  transform(value: string | null | undefined, empty = '—'): string {
    if (!value) return empty;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? empty : KYIV_DATETIME.format(date);
  }
}
