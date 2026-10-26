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

/** Сьогоднішня дата за Києвом (YYYY-MM-DD) — не залежить від часового поясу SSR-сервера. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

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
