/** Today's date in Kyiv (YYYY-MM-DD) — independent of the SSR server time zone. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
