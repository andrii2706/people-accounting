/** «localhost:5432/military» — which database a process works with, without the password (for the logs). */
export function databaseLabel(
  url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/military',
): string {
  // a Cloud SQL socket has no host in the address (…@/military?host=/cloudsql/…) — URL() does not read it
  const m = /^[a-z]+:\/\/(?:[^@/]*@)?([^/?]*)(\/[^?]*)?(?:\?(.*))?$/i.exec(url.trim());
  if (!m) return '(DATABASE_URL не читається)';
  const socket = new URLSearchParams(m[3] ?? '').get('host');
  const host = socket ?? (m[1].includes(':') ? m[1] : `${m[1] || 'localhost'}:5432`);
  return `${host}${m[2] ?? ''}`;
}
