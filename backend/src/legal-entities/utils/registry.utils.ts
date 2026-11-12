import type { RegistryCompany, RegistryRawCompany } from '../../shared/interfaces/legal-entity.interface.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The provider may answer with the company itself, `{ data: … }` or a list — take the first company found. */
export function pickRegistryCompany(body: unknown): RegistryRawCompany | null {
  if (Array.isArray(body)) return pickRegistryCompany(body[0]);
  if (!isRecord(body)) return null;
  if (typeof body.name === 'string' && body.name.trim()) return body as RegistryRawCompany;
  for (const key of ['data', 'result', 'company', 'item']) {
    const inner = pickRegistryCompany(body[key]);
    if (inner) return inner;
  }
  return null;
}

/** «ПЕТРЕНКО ІВАН ІВАНОВИЧ» → «Іван ПЕТРЕНКО» (the signature form of the documents). */
export function signatureName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName.trim();
  const [last, first] = parts;
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return `${first.split('-').map(cap).join('-')} ${last.toUpperCase()}`;
}

/** «79000, Львівська обл., м. Львів, …» → «79000». */
export function postalCodeFromAddress(address: string): string {
  return /(?:^|\D)(\d{5})(?:\D|$)/.exec(address)?.[1] ?? '';
}

export function toRegistryCompany(raw: RegistryRawCompany, code: string, source: string): RegistryCompany {
  const address = (raw.address ?? '').trim();
  return {
    edrpou: String(raw.egrpou ?? code).trim() || code,
    fullName: (raw.name ?? '').trim(),
    shortName: (raw.name_short ?? '').trim(),
    address,
    postalCode: postalCodeFromAddress(address),
    headName: raw.director ? signatureName(raw.director) : '',
    headFullName: (raw.director ?? '').trim().replace(/\s+/g, ' '),
    terminated: isTerminated(raw),
    kved: [raw.kved_number, raw.kved].filter(Boolean).join(' '),
    source,
  };
}

/** «припинено», «в стані припинення», «ліквідація», «банкрутство» — the company may not sign up. */
export function isTerminated(raw: RegistryRawCompany): boolean {
  const status = [raw.status, raw.state, raw.stan]
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase();
  return /припин|ліквід|банкрут/.test(status);
}
