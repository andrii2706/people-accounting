/** A request to our API: «api/…» (relative to <base href>) or the old absolute «/api/…». */
export function isApiUrl(url: string): boolean {
  return /^\/?api(\/|$)/.test(url);
}

/**
 * The path of an API request without the base of the application: «/oblik/api/x» (base «/oblik/») → «/api/x»;
 * null — not an API request.
 */
export function apiPathOf(pathname: string, baseHref: string): string | null {
  const base = baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length - 1) : pathname;
  return /^\/api(\/|$)/.test(rest) ? rest : null;
}
