/**
 * Converts raw cells into CreateEmployeeDto values and validates them with the same rules
 * as the employee form (class-validator DTO + the cross-field rules of the form).
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { type FieldError, flattenValidationErrors } from '../../common/validators.js';
import { MILITARY_DOCUMENT_TYPES } from '../../military/dictionaries.js';
import { AFTER_BIRTH_DATES, MESSAGE } from '../../military/employee-rules.js';
import { RANKS } from '../../military/ranks.js';
import { CreateEmployeeDto } from '../employees.dto.js';
import { columnForHeader, type ImportColumn, normalizeKey } from './import-columns.js';
import type { RawCell, RawTable } from './import-reader.js';

export type ImportValues = Record<string, string | number | boolean | null>;

export interface ImportRow {
  rowNumber: number;
  values: ImportValues;
  /** Problems found while reading the file (e.g. an unknown rank) — kept until the user edits the field. */
  issues: FieldError[];
}

export interface ImportContext {
  tcks: { id: string; name: string }[];
}

export interface ColumnMapping {
  header: string;
  field: string | null;
  label: string | null;
}

// ------------------------------------------------------------------ conversion

const str = (v: RawCell): string => {
  if (v === null) return '';
  if (v instanceof Date) return isoOf(v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).replace(/\s+/g, ' ').trim();
};

const isoOf = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** Excel date, serial number or text «12.03.1990», «12/03/1990», «1990-03-12», «12.03.90». */
export function parseDate(v: RawCell): string | null | undefined {
  if (v === null || str(v) === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : isoOf(v);
  if (typeof v === 'number') {
    if (v < 1 || v > 80000) return undefined;
    return isoOf(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000));
  }
  const text = str(v).replace(/\s*(р\.?|року)$/i, '');
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) return checked(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(text);
  if (m) {
    let year = +m[3];
    if (m[3].length === 2) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
    return checked(year, +m[2], +m[1]);
  }
  return undefined;
}

function checked(y: number, mo: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
  return isoOf(date);
}

const YES = new Set(['так', 'т', 'yes', 'y', 'true', '1', '+', 'x', 'х', 'є', 'заброньований', 'заброньована']);
const NO = new Set(['ні', 'н', 'no', 'n', 'false', '0', '-', '—', 'немає', 'нема']);

function parseBool(v: RawCell): boolean | null | undefined {
  if (typeof v === 'boolean') return v;
  const key = normalizeKey(str(v));
  if (!key) return null;
  if (YES.has(key)) return true;
  if (NO.has(key)) return false;
  return undefined;
}

function parseGender(v: RawCell): 'M' | 'F' | null | undefined {
  const key = normalizeKey(str(v));
  if (!key) return null;
  if (/^(ч|чол|чоловіча|чоловік|m|male|м|муж)/.test(key)) return 'M';
  if (/^(ж|жін|жіноча|жінка|f|female)/.test(key)) return 'F';
  return undefined;
}

/** Gender by the patronymic: -ович/-йович → M, -івна/-ївна/-ична → F. */
function genderByMiddleName(middleName: string): 'M' | 'F' | null {
  const m = middleName.toLowerCase();
  if (/(вич|ич)$/.test(m)) return 'M';
  if (/(вна|ична|івна|ївна)$/.test(m)) return 'F';
  return null;
}

const RANK_INDEX = new Map<string, { code: number; navy: boolean }>();
for (const r of RANKS) {
  RANK_INDEX.set(normalizeKey(r.army), { code: r.code, navy: false });
  if (r.navy !== r.army) RANK_INDEX.set(normalizeKey(r.navy), { code: r.code, navy: true });
}
RANK_INDEX.set('рядовий', { code: 2, navy: false });
RANK_INDEX.set('без звання', { code: 0, navy: false });

function parseRank(v: RawCell): { code: number; navy: boolean } | null | undefined {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 22) return { code: v, navy: false };
  const key = normalizeKey(str(v))
    // \b does not work with Cyrillic — the suffixes are matched after a space
    .replace(/\s(запасу|у запасі|в запасі|резерву|у відставці|медичної служби|юстиції)(?=\s|$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!key || key === '-' || key === '—') return null;
  return RANK_INDEX.get(key);
}

function findTck(v: RawCell, ctx: ImportContext): string | null | undefined {
  const key = normalizeKey(str(v));
  if (!key) return null;
  const exact = ctx.tcks.find((t) => normalizeKey(t.name) === key);
  if (exact) return exact.id;
  const partial = ctx.tcks.filter((t) => normalizeKey(t.name).includes(key) || key.includes(normalizeKey(t.name)));
  return partial.length === 1 ? partial[0].id : undefined;
}

function parsePassportType(v: RawCell): 'ID_CARD' | 'BOOK' | null | undefined {
  const key = normalizeKey(str(v));
  if (!key) return null;
  if (/id|айді|картк/.test(key)) return 'ID_CARD';
  if (/книж|book|паперов/.test(key)) return 'BOOK';
  return undefined;
}

const DOC_TYPES = MILITARY_DOCUMENT_TYPES.map((t) => [normalizeKey(t), t] as const);
function parseMilitaryDocType(v: RawCell): string | null {
  const key = normalizeKey(str(v));
  if (!key) return null;
  if (/електрон|е-вод|резерв\+/.test(key)) return 'військово-обліковий документ в електронній формі';
  if (/тимчасов/.test(key)) return 'тимчасове посвідчення військовозобов’язаного';
  if (/офіцер/.test(key)) return 'посвідчення особи офіцера';
  if (/припис/.test(key)) return 'посвідчення про приписку до призовної дільниці';
  if (/квиток/.test(key)) return 'військовий квиток';
  return DOC_TYPES.find(([k]) => k === key)?.[1] ?? str(v);
}

/** Maps the file headers to fields. */
export function mapColumns(headers: string[]): { mapping: ColumnMapping[]; columns: (ImportColumn | undefined)[] } {
  const used = new Set<string>();
  const columns = headers.map((h) => {
    const column = h ? columnForHeader(h) : undefined;
    if (!column || used.has(column.field)) return undefined; // the first column with this meaning wins
    used.add(column.field);
    return column;
  });
  return {
    columns,
    mapping: headers
      .map((header, i) => ({ header, field: columns[i]?.field ?? null, label: columns[i]?.header ?? null }))
      .filter((m) => m.header),
  };
}

export function convertRows(table: RawTable, ctx: ImportContext): { mapping: ColumnMapping[]; rows: ImportRow[] } {
  const { mapping, columns } = mapColumns(table.headers);
  const rows = table.rows.map(({ rowNumber, cells }) => {
    const values: ImportValues = {};
    const issues: FieldError[] = [];
    const issue = (field: string, message: string) => issues.push({ field, message });

    columns.forEach((column, i) => {
      if (!column) return;
      const cell = cells[i] ?? null;
      const text = str(cell);
      const { field } = column;
      switch (column.kind) {
        case 'text':
          if (text) values[field] = text;
          break;
        case 'upper':
          if (text) values[field] = text.toUpperCase().replace(/\s/g, '');
          break;
        case 'digits': {
          if (!text) break;
          let digits = text.replace(/[\s-]/g, '');
          if (field === 'rnokpp' && typeof cell === 'number' && digits.length < 10) digits = digits.padStart(10, '0');
          values[field] = digits;
          break;
        }
        case 'date': {
          if (field === 'deferralUntil' && /мобіліз/i.test(text)) {
            values.deferralUntilMobilizationEnd = true;
            break;
          }
          const date = parseDate(cell);
          if (date === undefined) issue(field, `Не вдалося розпізнати дату «${text}» (очікується ДД.ММ.РРРР)`);
          else if (date) values[field] = date;
          break;
        }
        case 'gender': {
          const g = parseGender(cell);
          if (g === undefined) issue(field, `Невідома стать «${text}» (чоловіча / жіноча)`);
          else if (g) values[field] = g;
          break;
        }
        case 'bool': {
          const b = parseBool(cell);
          if (b === undefined) issue(field, `Очікується «так» або «ні», а не «${text}»`);
          else if (b !== null) values[field] = b;
          break;
        }
        case 'rank': {
          const rank = parseRank(cell);
          if (rank === undefined) issue('rankCode', `Невідоме звання «${text}»`);
          else if (rank) {
            values.rankCode = rank.code;
            if (rank.navy) values.navy = true;
          }
          break;
        }
        case 'tck': {
          const id = findTck(cell, ctx);
          if (id === undefined) issue('tckId', `ТЦК «${text}» не знайдено в довіднику (Налаштування → ТЦК)`);
          else if (id) values.tckId = id;
          break;
        }
        case 'passportType': {
          const t = parsePassportType(cell);
          if (t === undefined) issue(field, `Невідомий тип паспорта «${text}» (ID-картка / книжечка)`);
          else if (t) values[field] = t;
          break;
        }
        case 'militaryDocType': {
          const t = parseMilitaryDocType(cell);
          if (t) values[field] = t;
          break;
        }
        case 'fullName': {
          const [last, first, ...middle] = text.split(' ');
          if (last && values.lastName === undefined) values.lastName = last;
          if (first && values.firstName === undefined) values.firstName = first;
          if (middle.length && values.middleName === undefined) values.middleName = middle.join(' ');
          break;
        }
        case 'passport': {
          const compact = text.replace(/[\s№-]/g, '').toUpperCase();
          const book = /^([А-ЩЬЮЯҐЄІЇ]{2})(\d{6})$/u.exec(compact);
          if (book) Object.assign(values, { passportType: 'BOOK', passportSeries: book[1], passportNumber: book[2] });
          else if (/^\d{9}$/.test(compact)) Object.assign(values, { passportType: 'ID_CARD', passportNumber: compact });
          else if (text) issue('passportNumber', `Не вдалося розібрати паспорт «${text}» (АА 123456 або 9 цифр ID-картки)`);
          break;
        }
      }
    });

    // inferred values
    if (values.gender === undefined && !issues.some((i) => i.field === 'gender')) {
      const g = genderByMiddleName(String(values.middleName ?? ''));
      if (g) values.gender = g;
    }
    if (values.passportType === undefined && values.passportNumber) {
      values.passportType = values.passportSeries || /^\d{6}$/.test(String(values.passportNumber)) ? 'BOOK' : 'ID_CARD';
    }
    return { rowNumber, values, issues };
  });
  return { mapping, rows };
}

// ------------------------------------------------------------------ validation

/** One military document from the file is kept as flat fields on the preview (easy to edit). */
const DOC_FIELDS: Record<string, string> = {
  militaryDocType: 'type',
  militaryDocSeries: 'series',
  militaryDocNumber: 'number',
  militaryDocIssuedBy: 'issuedBy',
  militaryDocIssuedAt: 'issuedAt',
};
const DOC_FIELD_BY_KEY = Object.fromEntries(Object.entries(DOC_FIELDS).map(([flat, key]) => [key, flat]));

/** Row values → CreateEmployeeDto (the flat document fields become militaryDocuments[0]). */
export function toDtoValues(values: ImportValues): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  const doc: Record<string, unknown> = {};
  for (const [flat, key] of Object.entries(DOC_FIELDS)) {
    if (flat in out) {
      doc[key] = out[flat];
      delete out[flat];
    }
  }
  if (Object.keys(doc).length) out.militaryDocuments = [doc];
  return out;
}

/** The same checks as the employee form; returns errors bound to fields. */
export async function validateValues(values: ImportValues): Promise<FieldError[]> {
  const dto = plainToInstance(CreateEmployeeDto, toDtoValues(values));
  const errors = flattenValidationErrors(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map((e) => {
    const m = /^militaryDocuments\.0\.(\w+)$/.exec(e.field);
    return m && DOC_FIELD_BY_KEY[m[1]] ? { ...e, field: DOC_FIELD_BY_KEY[m[1]] } : e;
  });
  if (!values.gender && !errors.some((e) => e.field === 'gender')) errors.push({ field: 'gender', message: 'Вкажіть стать' });

  const rank = values.rankCode;
  // cross-field rules of the form (employee-form.component.ts)
  if (values.militaryRegistered !== false && rank !== undefined && rank !== null && !values.tckId) {
    errors.push({ field: 'tckId', message: 'Оберіть ТЦК — без нього не сформується повідомлення' });
  }
  if (values.reserved === true && rank !== 0 && !values.reservationUntil) {
    errors.push({ field: 'reservationUntil', message: 'Вкажіть строк бронювання' });
  }
  const birth = values.birthDate as string | undefined;
  if (birth) {
    for (const key of AFTER_BIRTH_DATES) {
      const value = values[key] as string | undefined;
      if (value && value < birth) errors.push({ field: key, message: MESSAGE.beforeBirth });
    }
  }
  return errors;
}

export const fullNameOf = (v: ImportValues) => [v.lastName, v.firstName, v.middleName].filter(Boolean).join(' ');
