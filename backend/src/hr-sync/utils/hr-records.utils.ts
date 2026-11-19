import { formatUa } from '../../common/utils/dates.utils.js';
import { IMPORT_COLUMNS } from '../../employees/import/import.constants.js';
import {
  convertRows,
  fullNameOf,
  parseDate,
  toDtoValues,
  validateValues,
} from '../../employees/import/utils/import-rows.utils.js';
import type { Employee } from '../../employees/entities/employee.entity.js';
import { normalizePhone, normalizeVos } from '../../military/employee-rules.js';
import { rankTitle } from '../../military/ranks.js';
import { HR_DOC_FIELDS, HR_FIELD_LABELS, HR_MILITARY_FIELDS, HR_PERSONNEL_FIELDS } from '../hr-sync.constants.js';
import type {
  HrBatchCounts,
  HrBatchItem,
  HrFieldChange,
  HrPlannedItem,
  HrPlanOptions,
  HrRecord,
} from '../../shared/interfaces/hr-sync.interface.js';
import type { ImportValues, RawCell, RawTable } from '../../shared/interfaces/import.interface.js';

/** Field of the import ← the value of a record (the import columns parse and check it like a file row). */
const RECORD_CELLS: [string, (r: HrRecord) => unknown][] = [
  ['personnelNumber', (r) => r.personnelNumber],
  ['lastName', (r) => r.lastName],
  ['firstName', (r) => r.firstName],
  ['middleName', (r) => r.middleName],
  ['fullName', (r) => r.fullName],
  ['gender', (r) => r.gender],
  ['birthDate', (r) => r.birthDate],
  ['rnokpp', (r) => r.rnokpp],
  ['phone', (r) => r.phone],
  ['email', (r) => r.email],
  ['registeredAddress', (r) => r.registeredAddress],
  ['actualAddress', (r) => r.actualAddress],
  ['passport', (r) => r.passport],
  ['passportIssuedBy', (r) => r.passportIssuedBy],
  ['passportIssuedAt', (r) => r.passportIssuedAt],
  ['position', (r) => r.position],
  ['department', (r) => r.department],
  ['hireDate', (r) => r.hireDate],
  ['hireOrderNumber', (r) => r.hireOrderNumber],
  ['hireOrderDate', (r) => r.hireOrderDate],
  ['militaryRegistered', (r) => r.military?.registered],
  ['servedInArmy', (r) => r.military?.servedInArmy],
  ['rankCode', (r) => r.military?.rank],
  ['vos', (r) => r.military?.vos],
  ['registryNumber', (r) => r.military?.registryNumber],
  ['militaryDocType', (r) => r.military?.document?.type],
  ['militaryDocSeries', (r) => r.military?.document?.series],
  ['militaryDocNumber', (r) => r.military?.document?.number],
  ['militaryDocIssuedBy', (r) => r.military?.document?.issuedBy],
  ['militaryDocIssuedAt', (r) => r.military?.document?.issuedAt],
  ['tckId', (r) => r.military?.tck],
  ['fitness', (r) => r.military?.fitness],
  ['fitnessDate', (r) => r.military?.fitnessDate],
];

const HEADER_OF = new Map(IMPORT_COLUMNS.map((c) => [c.field, c.header]));

const cell = (v: unknown): RawCell => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  return String(v).slice(0, 500);
};

/** Records as a table with the headers of the import — read by the same converter as an Excel file. */
export function recordsToTable(records: HrRecord[]): RawTable {
  return {
    headers: RECORD_CELLS.map(([field]) => HEADER_OF.get(field) ?? field),
    rows: records.map((r, i) => ({ rowNumber: i + 1, cells: RECORD_CELLS.map(([, get]) => cell(get(r))) })),
  };
}

/** A stable key of a record in the batch (for the review page): the 1C reference, the personnel number or the place. */
export const recordKey = (r: HrRecord, index: number) =>
  String(r.externalId || (r.personnelNumber ? `tab:${r.personnelNumber}` : `row:${index + 1}`)).slice(0, 80);

const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const blank = (v: unknown) => v === undefined || v === null || v === '';
const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’ʼ`']/g, '’')
    .replace(/\s+/g, ' ');

/** Value of a field for the review: dates as ДД.ММ.РРРР, booleans as так / ні, the rank and the TCK by name. */
function display(field: string, value: unknown, tckName: (id: string) => string): string {
  if (blank(value)) return '';
  if (typeof value === 'boolean') return value ? 'так' : 'ні';
  if (field === 'gender') return value === 'M' ? 'чоловіча' : 'жіноча';
  if (field === 'rankCode') return rankTitle(Number(value)) || 'без звання';
  if (field === 'tckId') return tckName(String(value)) || String(value);
  if (field === 'passportType') return value === 'ID_CARD' ? 'ID-картка' : 'книжечка';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return formatUa(String(value));
  return String(value);
}

/** The value we would store — the same normalisation as the employees service, so equal data is not «changed». */
function stored(field: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (field === 'phone') return normalizePhone(value);
  if (field === 'vos') return normalizeVos(value);
  return value.trim();
}

const same = (field: string, a: unknown, b: unknown) =>
  ['lastName', 'firstName', 'middleName', 'email', 'registeredAddress', 'actualAddress', 'passportIssuedBy'].includes(
    field,
  )
    ? norm(a) === norm(b)
    : String(a ?? '') === String(b ?? '');

export interface HrPlanContext extends HrPlanOptions {
  /** employees of the legal entity (with positions and military documents) */
  employees: Employee[];
  tcks: { id: string; name: string }[];
  /** blind index of a RNOKPP (the same as in the employees table) */
  hash: (rnokpp: string) => string | null;
}

/**
 * What a batch of records will do to our cards. Nothing is saved.
 * Matching: the 1C reference → RNOKPP → full name + date of birth. 1C is the source of the personnel fields;
 * the military fields follow the policy; a dismissal in 1C dismisses here (and queues the TCK notice).
 */
export async function planBatch(records: HrRecord[], ctx: HrPlanContext): Promise<HrPlannedItem[]> {
  const { rows } = convertRows(recordsToTable(records), { tcks: ctx.tcks });
  const tckNames = new Map(ctx.tcks.map((t) => [t.id, t.name]));
  const tckName = (id: string) => tckNames.get(id) ?? '';

  const byExternal = new Map<string, Employee>();
  const byHash = new Map<string, Employee>();
  const byName = new Map<string, Employee[]>();
  for (const e of ctx.employees) {
    if (e.externalId) byExternal.set(e.externalId, e);
    if (e.rnokppHash) byHash.set(e.rnokppHash, e);
    const key = norm(`${e.lastName} ${e.firstName} ${e.middleName}|${e.birthDate ?? ''}`);
    byName.set(key, [...(byName.get(key) ?? []), e]);
  }

  // one person, two employee records (the main job and an internal part-time job in ЗУП): the one already linked
  // to a card wins, then the working one, then the latest hired. Two DIFFERENT people with one RNOKPP — an error
  // of 1C: both are left for a human.
  const primaryOf = new Map<string, number>();
  const clashes = new Map<number, number>();
  const person = (j: number) => norm(`${fullNameOf(rows[j].values)}|${rows[j].values.birthDate ?? ''}`);
  rows.forEach((row, i) => {
    const rnokpp = str(row.values.rnokpp);
    if (!rnokpp) return;
    const other = primaryOf.get(rnokpp);
    if (other === undefined) return primaryOf.set(rnokpp, i);
    if (person(other) !== person(i)) {
      clashes.set(i, other);
      clashes.set(other, i);
      return;
    }
    const linked = (j: number) => !!records[j].externalId && byExternal.has(records[j].externalId!);
    const dismissed = (j: number) => !!parseDate(cell(records[j].dismissalDate));
    const hired = (j: number) => str(rows[j].values.hireDate);
    const better =
      linked(other) !== linked(i)
        ? linked(i)
        : dismissed(other) !== dismissed(i)
          ? !dismissed(i)
          : hired(i) > hired(other);
    if (better) primaryOf.set(rnokpp, i);
  });

  const taken = new Map<string, string>();
  const out: HrPlannedItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const record = records[i];
    const values = rows[i].values;
    const item: HrPlannedItem = {
      key: recordKey(record, i),
      action: 'UNCHANGED',
      fullName: fullNameOf(values) || String(record.fullName ?? '').trim() || '—',
      personnelNumber: String(values.personnelNumber ?? ''),
      employeeId: null,
      changes: [],
      messages: rows[i].issues.map((x) => `${HR_FIELD_LABELS[x.field] ?? x.field}: ${x.message}`),
    };
    out.push(item);

    const dismissal = parseDate(cell(record.dismissalDate));
    if (dismissal === undefined) item.messages.push(`Дата звільнення: не вдалося розпізнати «${record.dismissalDate}»`);
    const rnokpp = String(values.rnokpp ?? '');
    const clash = clashes.get(i);
    if (clash !== undefined) {
      const other = fullNameOf(rows[clash].values) || '—';
      conflict(item, `У 1С той самий РНОКПП, що й у «${other}» — виправте в 1С`);
      continue;
    }
    if (rnokpp && primaryOf.get(rnokpp) !== i) {
      item.action = 'SKIP';
      item.messages.push('Інше місце роботи тієї ж особи в 1С (сумісництво) — враховано основне');
      continue;
    }

    // the card this record belongs to
    const hash = rnokpp ? ctx.hash(rnokpp) : null;
    const byRef = record.externalId ? byExternal.get(record.externalId) : undefined;
    const byTax = hash ? byHash.get(hash) : undefined;
    const sameName = byName.get(norm(`${fullNameOf(values)}|${values.birthDate ?? ''}`)) ?? [];
    const match = byRef ?? byTax ?? (values.birthDate && sameName.length === 1 ? sameName[0] : undefined);
    if (byRef && byTax && byRef.id !== byTax.id) {
      conflict(item, 'У 1С цей РНОКПП в іншого працівника, ніж у нас — перевірте обидві картки');
      continue;
    }
    if (match && record.externalId && match.externalId && match.externalId !== record.externalId && !byRef) {
      conflict(item, 'Цю картку вже пов’язано з іншим працівником 1С');
      continue;
    }
    if (match) {
      const first = taken.get(match.id);
      if (first) {
        conflict(item, `Та сама картка, що й у «${first}» — у 1С два записи на одну людину`);
        continue;
      }
      taken.set(match.id, item.fullName);
    }

    if (!match) {
      if (dismissal && !ctx.importDismissed) {
        item.action = 'SKIP';
        item.messages.push(`Звільнений у 1С ${formatUa(dismissal)} — не додається`);
        continue;
      }
      planCreate(item, values, record, dismissal ?? null, ctx);
      // the link to 1C is not a field of the card form — checked without it
      const { externalId: _link, ...checked } = item.create as ImportValues;
      const errors = await validateValues(checked);
      if (errors.length || rows[i].issues.length) {
        item.action = 'ERROR';
        for (const e of errors) item.messages.push(`${HR_FIELD_LABELS[e.field] ?? e.field}: ${e.message}`);
        delete item.create;
      }
      continue;
    }

    item.employeeId = match.id;
    await planUpdate(item, match, values, record, dismissal ?? null, ctx, tckName);
  }
  return out;
}

function conflict(item: HrPlannedItem, message: string) {
  item.action = 'CONFLICT';
  item.messages.push(message);
}

function planCreate(
  item: HrPlannedItem,
  values: ImportValues,
  record: HrRecord,
  dismissal: string | null,
  ctx: HrPlanContext,
) {
  const create: ImportValues = { ...values };
  if (ctx.militaryPolicy === 'IGNORE') {
    for (const f of [...HR_MILITARY_FIELDS, ...HR_DOC_FIELDS]) {
      // registration of men stays on by default (as on a new card); the rest comes from our side
      if (f !== 'militaryRegistered') delete create[f];
    }
  }
  if (record.externalId) create.externalId = record.externalId;
  if (dismissal) {
    create.dismissalDate = dismissal;
    if (record.dismissalOrderNumber) create.dismissalOrderNumber = String(record.dismissalOrderNumber).trim();
    const orderDate = parseDate(cell(record.dismissalOrderDate));
    if (orderDate) create.dismissalOrderDate = orderDate;
  }
  item.action = 'CREATE';
  item.create = create;
}

async function planUpdate(
  item: HrPlannedItem,
  e: Employee,
  values: ImportValues,
  record: HrRecord,
  dismissal: string | null,
  ctx: HrPlanContext,
  tckName: (id: string) => string,
) {
  const update: Record<string, unknown> = {};
  const change = (field: string, from: unknown, to: unknown) =>
    item.changes.push({
      field,
      label: HR_FIELD_LABELS[field] ?? field,
      from: display(field, from, tckName),
      to: display(field, to, tckName),
    } satisfies HrFieldChange);
  const current = e as unknown as Record<string, unknown>;

  // personnel data: 1C is the source — a filled value replaces ours, an empty one never erases
  for (const field of HR_PERSONNEL_FIELDS) {
    if (field === 'gender' && blank(record.gender)) continue; // guessed by the patronymic — not data of 1C
    const next = stored(field, values[field]);
    if (blank(next) || same(field, current[field], next)) continue;
    update[field] = next;
    change(field, current[field], next);
  }

  // position / department → a new entry of the positions list from today (the history stays)
  const position = String(values.position ?? '').trim();
  const department = String(values.department ?? '').trim();
  if (
    position &&
    (!same('position', e.position, position) || (department && !same('department', e.department, department)))
  ) {
    const list = [...(e.positions ?? [])]
      .sort((a, b) => (a.since ?? '').localeCompare(b.since ?? ''))
      .map((p) => ({
        position: p.position,
        department: p.department,
        since: p.since,
        orderDocName: p.orderDocName,
        orderNumber: p.orderNumber,
        orderDate: p.orderDate,
      }));
    const since = list.length ? ctx.today : e.hireDate || ctx.today;
    const last = list.at(-1);
    if (last && last.since === since) list.pop(); // the same day — corrected, not a second transfer
    list.push({
      position,
      department: department || e.department,
      since,
      orderDocName: '',
      orderNumber: '',
      orderDate: null,
    });
    update.positions = list;
    if (!same('position', e.position, position)) change('position', e.position, position);
    if (department && !same('department', e.department, department)) change('department', e.department, department);
  }

  // military data — by the policy
  if (ctx.militaryPolicy !== 'IGNORE') {
    const overwrite = ctx.militaryPolicy === 'OVERWRITE';
    for (const field of HR_MILITARY_FIELDS) {
      if (field === 'militaryRegistered' && blank(record.military?.registered)) continue; // a default, not data of 1C
      const next = stored(field, values[field]);
      if (blank(next) || same(field, current[field], next)) continue;
      // «fill the empty ones»: a yes/no flag always has a value — it is changed only by «replace»
      const empty = typeof current[field] === 'boolean' ? false : blank(current[field]);
      if (!overwrite && !empty) continue;
      update[field] = next;
      change(field, current[field], next);
    }
    if (update.rankCode !== undefined && values.navy !== undefined) update.navy = values.navy;

    const doc = toDtoValues(
      Object.fromEntries(HR_DOC_FIELDS.filter((f) => !blank(values[f])).map((f) => [f, values[f]])),
    ).militaryDocuments as Record<string, unknown>[] | undefined;
    const incoming = doc?.[0];
    const docs = e.militaryDocuments ?? [];
    if (incoming && (docs.length === 0 || overwrite)) {
      const first = docs[0] as unknown as Record<string, unknown> | undefined;
      const differs =
        !first ||
        ['type', 'series', 'number', 'issuedBy', 'issuedAt'].some(
          (k) => !blank(incoming[k]) && str(first[k]) !== str(incoming[k]),
        );
      if (differs) {
        const rest = docs.slice(1).map((d) => ({
          type: d.type,
          series: d.series,
          number: d.number,
          issuedBy: d.issuedBy,
          issuedAt: d.issuedAt,
        }));
        update.militaryDocuments = [
          {
            ...(first
              ? {
                  type: first.type,
                  series: first.series,
                  number: first.number,
                  issuedBy: first.issuedBy,
                  issuedAt: first.issuedAt,
                }
              : {}),
            ...incoming,
          },
          ...rest,
        ];
        const text = (d?: Record<string, unknown>) =>
          d ? [d.type, [d.series, d.number].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
        change('militaryDocuments', text(first), text(incoming));
      }
    }
  }

  // dismissal
  if (dismissal && !e.dismissalDate) {
    if (e.hireDate && dismissal < e.hireDate) {
      item.messages.push(`Дата звільнення в 1С (${formatUa(dismissal)}) раніша за дату прийняття — не застосовано`);
    } else {
      update.dismissalDate = dismissal;
      if (record.dismissalOrderNumber) update.dismissalOrderNumber = String(record.dismissalOrderNumber).trim();
      const orderDate = parseDate(cell(record.dismissalOrderDate));
      if (orderDate) update.dismissalOrderDate = orderDate;
      change('dismissalDate', null, dismissal);
    }
  } else if (!dismissal && e.dismissalDate && (record.hireDate ?? '') !== '') {
    const hire = String(values.hireDate ?? '');
    if (hire && hire > e.dismissalDate) {
      conflict(
        item,
        `У нас звільнений ${formatUa(e.dismissalDate)}, а в 1С працює з ${formatUa(hire)} — повторне прийняття оформіть вручну`,
      );
      return;
    }
  }

  // validate what will be written: a bad value of 1C is not applied, the rest is
  if (Object.keys(update).length) {
    const merged: ImportValues = {
      lastName: e.lastName,
      firstName: e.firstName,
      middleName: e.middleName,
      gender: e.gender,
      birthDate: e.birthDate,
    };
    for (const [k, v] of Object.entries(update)) {
      if (k !== 'positions' && k !== 'militaryDocuments') merged[k] = v as ImportValues[string];
    }
    const errors = (await validateValues(merged)).filter((x) => x.field in update);
    for (const err of errors) {
      delete update[err.field];
      item.changes = item.changes.filter((c) => c.field !== err.field);
      item.messages.push(`${HR_FIELD_LABELS[err.field] ?? err.field}: ${err.message} — не застосовано`);
    }
  }

  if (record.externalId && e.externalId !== record.externalId && Object.keys(update).length === 0) {
    // only the link to 1C — saved silently, not a change of the card
    update.externalId = record.externalId;
  } else if (record.externalId && e.externalId !== record.externalId) {
    update.externalId = record.externalId;
  }

  const meaningful = item.changes.length > 0;
  if (!Object.keys(update).length) {
    item.action = 'UNCHANGED';
    return;
  }
  item.update = update;
  item.action = update.dismissalDate ? 'DISMISS' : meaningful ? 'UPDATE' : 'UNCHANGED';
}

export function countItems(items: HrBatchItem[]): HrBatchCounts {
  const counts: HrBatchCounts = {
    total: items.length,
    create: 0,
    update: 0,
    dismiss: 0,
    unchanged: 0,
    skip: 0,
    error: 0,
    conflict: 0,
  };
  for (const item of items) {
    const key = item.action.toLowerCase() as Exclude<keyof HrBatchCounts, 'total'>;
    counts[key]++;
  }
  return counts;
}

/** The part of an item that is stored and shown (without the values to apply). */
export function publicItem({ create: _c, update: _u, ...item }: HrPlannedItem): HrBatchItem {
  return item;
}
