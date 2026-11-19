import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { resolvePublicHost } from '../../entity-databases/utils/db-host.utils.js';
import { HR_MAX_RECORDS_PER_READ, ODATA_MAX_BYTES, ODATA_PAGE_SIZE, ODATA_TIMEOUT_MS } from '../hr-sync.constants.js';
import type { HrRecord } from '../../shared/interfaces/hr-sync.interface.js';
import {
  detectProfile,
  odataBase,
  odataDate,
  odataGender,
  odataRef,
  parseMetadata,
  type ResolvedProfile,
} from './odata-metadata.utils.js';

type Row = Record<string, unknown>;

/** A scalar of a 1C answer as text (an object or an array — not a value we read). */
const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

export interface ODataConnection {
  url: string;
  user: string;
  password: string;
  /** Development only: a 1C server in the local network. */
  allowPrivate: boolean;
}

/** An error to show on the settings page: no password, no internals. */
export class ODataError extends Error {}

/**
 * Reads the employees of one organization from a published 1C base (standard OData interface, JSON).
 * The host is resolved once and checked (no internal addresses — the same rule as for own databases),
 * the connection goes to that address; HTTPS only, except in development.
 */
export class OneCODataClient {
  private readonly base: URL;
  private address = '';

  constructor(private readonly conn: ODataConnection) {
    let url: URL;
    try {
      url = new URL(odataBase(conn.url));
    } catch {
      throw new ODataError('Невірна адреса публікації 1С');
    }
    if (url.protocol !== 'https:' && !(conn.allowPrivate && url.protocol === 'http:')) {
      throw new ODataError('Адреса публікації 1С має починатися з https:// — дані працівників не передаються відкрито');
    }
    if (url.username || url.password) throw new ODataError('Логін і пароль вказуйте в окремих полях, не в адресі');
    this.base = url;
  }

  /** The tables of the publication and the configuration recognised by them. */
  async profile(): Promise<ResolvedProfile> {
    const xml = await this.get('$metadata', 'application/xml');
    const resolved = detectProfile(parseMetadata(xml));
    if (!resolved) {
      throw new ODataError(
        'У публікації немає довідників «Сотрудники» і «ФизическиеЛица» — додайте їх до складу OData (див. інструкцію)',
      );
    }
    return resolved;
  }

  async organizations(p: ResolvedProfile): Promise<{ ref: string; code: string; name: string }[]> {
    const code = p.fields.organizationCode;
    const rows = await this.list(p.profile.organizations, ['Ref_Key', 'Description', code].filter(Boolean));
    return rows.map((r) => ({ ref: str(r.Ref_Key), code: code ? str(r[code]).trim() : '', name: str(r.Description) }));
  }

  /** The employees of the organization with the code `organizationCode` (all, if the code is empty). */
  async employees(p: ResolvedProfile, organizationCode: string): Promise<HrRecord[]> {
    const f = p.fields;
    const orgs = await this.organizations(p);
    const org = organizationCode ? orgs.find((o) => o.code === organizationCode) : undefined;
    if (organizationCode && !org) {
      throw new ODataError(`У 1С немає організації з кодом ЄДРПОУ ${organizationCode}`);
    }

    const employees = await this.list(
      p.profile.employees,
      [
        'Ref_Key',
        'DeletionMark',
        f.employeeCode,
        f.employeeName,
        f.employeePerson,
        f.employeeOrganization,
        f.employeeArchived,
        f.employeeActive,
        f.employeePosition,
        f.employeeDepartment,
        f.employeeHireDate,
        f.employeeDismissalDate,
      ].filter(Boolean),
    );
    const staff = p.hasStaff
      ? await this.list(
          p.profile.staff,
          [
            f.staffEmployee,
            f.staffOrganization,
            f.staffPosition,
            f.staffDepartment,
            f.staffHireDate,
            f.staffDismissalDate,
          ].filter(Boolean),
        )
      : [];
    const staffBy = new Map(staff.map((s) => [odataRef(s[f.staffEmployee]), s]));
    const persons = await this.list(
      p.profile.persons,
      ['Ref_Key', 'Description', f.personBirthDate, f.personGender, f.personTaxId].filter(Boolean),
    );
    const personBy = new Map(persons.map((r) => [str(r.Ref_Key), r]));
    const names = p.hasNames
      ? await this.list(
          p.profile.names,
          ['Period', f.namesPerson, f.namesLast, f.namesFirst, f.namesMiddle].filter(Boolean),
        )
      : [];
    // the latest name of every person (a changed surname keeps the history)
    const nameBy = new Map<string, Row>();
    for (const n of names.sort((a, b) => str(a.Period).localeCompare(str(b.Period)))) {
      nameBy.set(odataRef(n[f.namesPerson]), n);
    }
    const positions = await this.dictionary(p.profile.positions);
    const departments = await this.dictionary(p.profile.departments);

    const out: HrRecord[] = [];
    for (const e of employees) {
      if (e.DeletionMark === true) continue;
      const s = staffBy.get(str(e.Ref_Key));
      const orgRef = odataRef(s?.[f.staffOrganization]) || odataRef(e[f.employeeOrganization]);
      if (org && orgRef !== org.ref) continue;
      const person = personBy.get(odataRef(e[f.employeePerson]));
      const name = nameBy.get(odataRef(e[f.employeePerson]));
      const hire = odataDate(s?.[f.staffHireDate]) || odataDate(e[f.employeeHireDate]);
      const dismissal = odataDate(s?.[f.staffDismissalDate]) || odataDate(e[f.employeeDismissalDate]);
      // never hired (a candidate) — not an employee yet
      if (!hire && !dismissal) continue;
      out.push({
        externalId: str(e.Ref_Key),
        personnelNumber: str(e[f.employeeCode]).trim(),
        lastName: name ? str(name[f.namesLast]).trim() : undefined,
        firstName: name ? str(name[f.namesFirst]).trim() : undefined,
        middleName: name ? str(name[f.namesMiddle]).trim() : undefined,
        fullName: str(person?.Description ?? e[f.employeeName]).trim(),
        rnokpp: str(person?.[f.personTaxId]).trim(),
        birthDate: odataDate(person?.[f.personBirthDate]),
        gender: odataGender(person?.[f.personGender]),
        position: positions.get(odataRef(s?.[f.staffPosition]) || odataRef(e[f.employeePosition])) ?? '',
        department: departments.get(odataRef(s?.[f.staffDepartment]) || odataRef(e[f.employeeDepartment])) ?? '',
        hireDate: hire,
        dismissalDate: dismissal,
      });
      if (out.length > HR_MAX_RECORDS_PER_READ) {
        throw new ODataError(`У 1С понад ${HR_MAX_RECORDS_PER_READ} працівників — потрібне окреме налаштування`);
      }
    }
    return out;
  }

  /** Ref_Key → Description of a catalog (positions, departments); a catalog that is not published — empty. */
  private async dictionary(table: string): Promise<Map<string, string>> {
    if (!table) return new Map();
    try {
      const rows = await this.list(table, ['Ref_Key', 'Description']);
      return new Map(rows.map((r) => [str(r.Ref_Key), str(r.Description).trim()]));
    } catch (err) {
      if (err instanceof ODataError && /404/.test(err.message)) return new Map();
      throw err;
    }
  }

  /** All rows of an entity set, page by page. */
  private async list(table: string, select: string[]): Promise<Row[]> {
    const rows: Row[] = [];
    for (let skip = 0; ; skip += ODATA_PAGE_SIZE) {
      const query = new URLSearchParams({
        $format: 'json',
        $select: select.join(','),
        $top: String(ODATA_PAGE_SIZE),
        $skip: String(skip),
      });
      const body = JSON.parse(await this.get(`${encodeURIComponent(table)}?${query}`, 'application/json')) as {
        value?: Row[];
      };
      const page = body.value ?? [];
      rows.push(...page);
      if (page.length < ODATA_PAGE_SIZE || rows.length > HR_MAX_RECORDS_PER_READ * 4) return rows;
    }
  }

  private async get(path: string, accept: string): Promise<string> {
    if (!this.address) {
      const host = this.base.hostname.replace(/^\[|\]$/g, '');
      try {
        this.address = await resolvePublicHost(host, this.conn.allowPrivate);
      } catch (err) {
        throw new ODataError(
          err instanceof Error ? err.message.replace('бази даних', 'публікації 1С') : 'Сервер 1С не знайдено',
        );
      }
    }
    const url = new URL(`${this.base.pathname.replace(/\/$/, '')}/${path}`, this.base);
    const lib = url.protocol === 'https:' ? https : http;
    const address = this.address;
    return new Promise<string>((resolve, reject) => {
      const req = lib.request(
        url,
        {
          method: 'GET',
          headers: {
            Accept: accept,
            Authorization: `Basic ${Buffer.from(`${this.conn.user}:${this.conn.password}`).toString('base64')}`,
          },
          // the checked address, not the name again — a DNS answer cannot change in between
          lookup: (_host, opts, cb) =>
            (opts as { all?: boolean }).all
              ? (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [
                  { address, family: isIP(address) },
                ])
              : cb(null, address, isIP(address)),
          timeout: ODATA_TIMEOUT_MS,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (c: Buffer) => {
            size += c.length;
            if (size > ODATA_MAX_BYTES) {
              req.destroy(new ODataError('Відповідь 1С завелика'));
              return;
            }
            chunks.push(c);
          });
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode ?? 0;
            if (status === 401 || status === 403)
              reject(new ODataError('1С не прийняла логін або пароль (або в користувача немає прав на OData)'));
            else if (status === 404)
              reject(new ODataError(`1С: таблицю не опубліковано (404) — ${decodeURIComponent(path.split('?')[0])}`));
            else if (status >= 400) reject(new ODataError(`1С відповіла помилкою ${status}`));
            else resolve(text);
          });
        },
      );
      req.on('timeout', () => req.destroy(new ODataError('1С не відповіла вчасно')));
      req.on('error', (err) =>
        reject(
          err instanceof ODataError ? err : new ODataError(`Не вдалося з’єднатися з 1С: ${err.message.slice(0, 120)}`),
        ),
      );
      req.end();
    });
  }
}
