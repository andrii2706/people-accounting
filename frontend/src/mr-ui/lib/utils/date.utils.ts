import { UI_TIME_STEP_MINUTES } from '../constants/date.constants';

const pad = (n: number) => String(n).padStart(2, '0');

/** 2026, 11, 2 → «2026-11-02». */
export const uiToIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** «2026-11-02» — a date (the format only; a real day is checked by uiDisplayToIso). */
export const uiIsIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** «14:30» — a time of the day. */
export const uiIsTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** «2026-11-02» or «2026-11-02T14:30» → its parts; null — not such a value. */
export function uiSplitValue(value: string): { date: string; time: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(value ?? '');
  if (!m || (m[2] && !uiIsTime(m[2]))) return null;
  return { date: m[1]!, time: m[2] ?? '' };
}

/** The value as people read it: «02.11.2026» / «02.11.2026 14:30»; a typed text that is no value — as it is. */
export function uiValueToDisplay(value: string): string {
  const parts = uiSplitValue(value);
  if (!parts) return value ?? '';
  const [y, m, d] = parts.date.split('-');
  return `${d}.${m}.${y}${parts.time ? ` ${parts.time}` : ''}`;
}

/**
 * «02.11.2026» → «2026-11-02», «02.11.2026 14:30» → «2026-11-02T14:30» when it is a real day (and a real time);
 * otherwise the text itself — the form shows «Некоректна дата».
 */
export function uiDisplayToValue(text: string, withTime: boolean): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?: (\d{2}:\d{2}))?$/.exec(text);
  if (!m) return text;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
    return text;
  const iso = uiToIso(y, mo, d);
  if (!withTime) return m[4] ? text : iso;
  if (!m[4]) return iso;
  return uiIsTime(m[4]) ? `${iso}T${m[4]}` : text;
}

/** Digits → «ДД.ММ.РРРР» (and « ГГ:ХХ» with the time) while typing. */
export function uiMaskDateInput(raw: string, withTime = false): string {
  const digits = raw.replace(/\D/g, '').slice(0, withTime ? 12 : 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `.${digits.slice(2, 4)}`;
  if (digits.length > 4) out += `.${digits.slice(4, 8)}`;
  if (digits.length > 8) out += ` ${digits.slice(8, 10)}`;
  if (digits.length > 10) out += `:${digits.slice(10, 12)}`;
  return out;
}

/** «00:00», «00:30» … «23:30». */
export function uiTimeSlots(step = UI_TIME_STEP_MINUTES): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

/** Today in the browser: «2026-11-24». */
export function uiTodayIso(now = new Date()): string {
  return uiToIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
