/** Сьогоднішня дата за Києвом (YYYY-MM-DD) — не залежить від часового поясу SSR-сервера. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
