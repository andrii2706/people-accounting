/** Дати в API зберігаються як рядки ISO `YYYY-MM-DD` — без часових поясів. */
export type IsoDate = string;

export function todayIso(): IsoDate {
  const now = new Date();
  const kyiv = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return kyiv;
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Повних років на дату (формула список!AZ6). */
export function fullYears(birthDate: IsoDate | null | undefined, at: IsoDate): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ay, am, ad] = at.split('-').map(Number);
  let years = ay - by;
  if (am < bm || (am === bm && ad < bd)) years -= 1;
  return years;
}

/** dd.mm.yyyy — як TEXT(x,"dd.mm.yyyy") у файлі. */
export function formatUa(date: IsoDate | null | undefined, empty = '__________'): string {
  if (!date) return empty;
  const [y, m, d] = date.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

/** «6 вересня 2026» — як у відомості оперативного обліку (OCL!L8). */
export function formatUaLong(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_GENITIVE[m - 1]} ${y}`;
}
