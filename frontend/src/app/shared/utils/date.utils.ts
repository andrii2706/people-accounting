/** Today's date in Kyiv (YYYY-MM-DD) — independent of the SSR server time zone. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Protection against «0002-05-12» from typing the year by hand in a date input. */
export const sensibleDate = (v: string) =>
  !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01' && v <= '2100-12-31');

/** 7 → «07». */
export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Year, month, day → «YYYY-MM-DD». */
export const toIso = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

/** Is the text an ISO date «YYYY-MM-DD». */
export const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** «2026-10-28» → «28.10.2026»; anything else is shown as typed. */
export function isoToDisplay(value: string): string {
  if (!value) return '';
  if (!isIso(value)) return value;
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

/** «28.10.2026» → ISO if it is a real date, otherwise the text itself (the form shows «Некоректна дата»). */
export function displayToIso(text: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!m) return text;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? toIso(y, mo, d)
    : text;
}

/** Digits → «ДД.ММ.РРРР» while typing. */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** «26.10.2026, 13:15» in Kyiv time — the same on SSR and in the browser. */
export const KYIV_DATETIME = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** ISO date + days (negative — back). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Report date — in the ?date=YYYY-MM-DD query parameter (today by default). */
export const reportDateOrToday = (date: string | null) =>
  date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso();
