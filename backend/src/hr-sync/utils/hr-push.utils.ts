import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import { HR_MAX_RECORDS_PER_PUSH, HR_TOKEN_PATTERN, HR_TOKEN_PREFIX } from '../hr-sync.constants.js';
import type { HrMilitary, HrMilitaryDocument, HrRecord } from '../../shared/interfaces/hr-sync.interface.js';

/** A new push key: shown once; only the hash of the secret and the public prefix are stored. */
export function issueToken(): { token: string; prefix: string; hash: string } {
  const prefix = `${HR_TOKEN_PREFIX}${randomBytes(4).toString('hex')}`;
  const secret = randomBytes(32).toString('base64url');
  return { token: `${prefix}_${secret}`, prefix, hash: sha256(secret) };
}

/** «Bearer mr1c_…» → the prefix to look the settings up and the secret to compare; null — not a key of ours. */
export function parseToken(header: string | undefined): { prefix: string; secret: string } | null {
  const raw = (header ?? '').replace(/^Bearer\s+/i, '').trim();
  const m = HR_TOKEN_PATTERN.exec(raw);
  return m ? { prefix: `${HR_TOKEN_PREFIX}${m[1]}`, secret: m[2] } : null;
}

export function tokenMatches(secret: string, storedHash: string): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(sha256(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** The problem with a push body, in words for the 1C administrator (shown in the 1C message window). */
export class PushFormatError extends Error {}

const text = (v: unknown, max = 300): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : undefined;
};
const flag = (v: unknown): boolean | string | undefined => (typeof v === 'boolean' ? v : text(v, 200));
const obj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

const TEXT_FIELDS = [
  'externalId',
  'personnelNumber',
  'lastName',
  'firstName',
  'middleName',
  'fullName',
  'rnokpp',
  'birthDate',
  'gender',
  'phone',
  'email',
  'registeredAddress',
  'actualAddress',
  'passport',
  'passportIssuedBy',
  'passportIssuedAt',
  'position',
  'department',
  'hireDate',
  'hireOrderNumber',
  'hireOrderDate',
  'dismissalDate',
  'dismissalOrderNumber',
  'dismissalOrderDate',
] as const satisfies readonly (keyof HrRecord)[];

/**
 * The body of POST /integrations/1c/employees → records. Unknown fields are ignored (a newer data processor
 * may send more), values are cut to sane lengths; only the shape is checked here — the values are checked
 * like a row of the import file.
 */
export function readPushBody(body: unknown): HrRecord[] {
  const root = obj(body);
  const list = Array.isArray(body) ? body : (root?.employees ?? root?.records);
  if (!Array.isArray(list)) throw new PushFormatError('Очікується JSON {"employees": [ … ]}');
  if (list.length === 0) throw new PushFormatError('Список працівників порожній');
  if (list.length > HR_MAX_RECORDS_PER_PUSH) {
    throw new PushFormatError(`За один запит — не більше ${HR_MAX_RECORDS_PER_PUSH} працівників, надсилайте частинами`);
  }
  return list.map((item, i) => {
    const r = obj(item);
    if (!r) throw new PushFormatError(`Працівник №${i + 1}: очікується об’єкт`);
    const out: HrRecord = {};
    for (const f of TEXT_FIELDS) {
      const v = text(r[f], f === 'registeredAddress' || f === 'actualAddress' ? 500 : 300);
      if (v !== undefined) out[f] = v;
    }
    const m = obj(r.military);
    if (m) {
      const military: HrMilitary = {};
      const registered = flag(m.registered);
      if (registered !== undefined) military.registered = registered;
      const served = flag(m.servedInArmy);
      if (served !== undefined) military.servedInArmy = served;
      for (const f of ['rank', 'vos', 'category', 'registryNumber', 'fitness', 'fitnessDate', 'tck'] as const) {
        const v = text(m[f]);
        if (v !== undefined) military[f] = v;
      }
      const d = obj(m.document);
      if (d) {
        const doc: HrMilitaryDocument = {};
        for (const f of ['type', 'series', 'number', 'issuedBy', 'issuedAt'] as const) {
          const v = text(d[f]);
          if (v !== undefined) doc[f] = v;
        }
        if (Object.keys(doc).length) military.document = doc;
      }
      if (Object.keys(military).length) out.military = military;
    }
    if (!out.lastName && !out.fullName)
      throw new PushFormatError(`Працівник №${i + 1}: немає прізвища (lastName або fullName)`);
    return out;
  });
}

/**
 * «203.0.113.5, 198.51.100.0/24» → the list as stored (one entry per address / network); throws the problem
 * in words when an entry is not an address.
 */
export function parseAllowedIps(text: string, max: number): string[] {
  const entries = text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length > max) throw new Error(`Не більше ${max} адрес`);
  for (const entry of entries) {
    const [addr, prefix, extra] = entry.split('/');
    const family = isIP(addr);
    const bits = family === 6 ? 128 : 32;
    if (!family || extra !== undefined || (prefix !== undefined && !(/^\d+$/.test(prefix) && Number(prefix) <= bits))) {
      throw new Error(`«${entry}» — не IP-адреса (приклад: 203.0.113.5 або 203.0.113.0/24)`);
    }
  }
  return [...new Set(entries)];
}

/** The address is in the list (an empty list — any address). */
export function ipAllowed(list: string[], ip: string): boolean {
  if (!list.length) return true;
  const address = ip.replace(/^::ffff:/, '');
  const family = isIP(address);
  if (!family) return false;
  const block = new BlockList();
  for (const entry of list) {
    const [addr, prefix] = entry.split('/');
    const type = isIP(addr) === 6 ? 'ipv6' : 'ipv4';
    if (prefix !== undefined) block.addSubnet(addr, Number(prefix), type);
    else block.addAddress(addr, type);
  }
  return block.check(address, family === 6 ? 'ipv6' : 'ipv4');
}
