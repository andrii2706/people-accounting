/**
 * Columns of the employee import file: the canonical header (used in the template),
 * header synonyms seen in 1C and HR spreadsheets, and how a cell value is converted.
 */
export type ColumnKind =
  | 'text'
  | 'upper'
  | 'digits'
  | 'date'
  | 'gender'
  | 'rank'
  | 'tck'
  | 'bool'
  | 'passportType'
  | 'militaryDocType'
  | 'fullName'
  | 'passport';

export interface ImportColumn {
  /** Field of CreateEmployeeDto; for compound columns (ПІБ, паспорт) — a pseudo-field. */
  field: string;
  header: string;
  kind: ColumnKind;
  synonyms?: string[];
  /** Not in the template — only recognized in uploaded files. */
  extraOnly?: boolean;
  /** Template column width (characters). */
  width?: number;
  note?: string;
}

export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  { field: 'personnelNumber', header: 'Табельний номер', kind: 'text', synonyms: ['таб номер', 'таб №', 'табельний №', 'табельний'], width: 12 },
  { field: 'lastName', header: 'Прізвище', kind: 'text', width: 16 },
  { field: 'firstName', header: 'Ім’я', kind: 'text', synonyms: ['імя', 'власне ім’я'], width: 14 },
  { field: 'middleName', header: 'По батькові', kind: 'text', synonyms: ['по-батькові'], width: 16 },
  {
    field: 'fullName',
    header: 'ПІБ',
    kind: 'fullName',
    extraOnly: true,
    synonyms: ['прізвище ім’я по батькові', 'прізвище ім’я та по батькові', 'прізвище, ім’я, по батькові', 'працівник', 'співробітник', 'фізична особа', 'фіз особа'],
  },
  { field: 'gender', header: 'Стать', kind: 'gender', width: 10, note: 'чоловіча / жіноча (якщо порожньо — визначається за по батькові)' },
  { field: 'birthDate', header: 'Дата народження', kind: 'date', width: 14 },
  {
    field: 'rnokpp',
    header: 'РНОКПП',
    kind: 'digits',
    synonyms: ['іпн', 'інн', 'ідентифікаційний код', 'ідентифікаційний номер', 'код дрфо', 'реєстраційний номер облікової картки платника податків', 'податковий номер'],
    width: 13,
  },
  { field: 'phone', header: 'Телефон', kind: 'text', synonyms: ['мобільний телефон', 'контактний телефон', 'тел'], width: 16 },
  { field: 'email', header: 'Email', kind: 'text', synonyms: ['e-mail', 'електронна пошта', 'ел пошта'], width: 20 },
  {
    field: 'registeredAddress',
    header: 'Адреса реєстрації',
    kind: 'text',
    synonyms: ['зареєстроване місце проживання', 'задеклароване місце проживання', 'адреса прописки', 'місце реєстрації', 'адреса за пропискою', 'адреса'],
    width: 30,
  },
  { field: 'actualAddress', header: 'Фактична адреса', kind: 'text', synonyms: ['фактичне місце проживання', 'адреса проживання', 'адреса фактичного проживання'], width: 30 },
  {
    field: 'passport',
    header: 'Паспорт',
    kind: 'passport',
    extraOnly: true,
    synonyms: ['серія та номер паспорта', 'серія і номер паспорта', 'паспорт серія номер', 'документ що посвідчує особу'],
  },
  { field: 'passportType', header: 'Тип паспорта', kind: 'passportType', width: 14, note: 'ID-картка / книжечка (якщо порожньо — визначається за номером)' },
  { field: 'passportSeries', header: 'Серія паспорта', kind: 'upper', width: 10 },
  { field: 'passportNumber', header: 'Номер паспорта', kind: 'digits', width: 14 },
  { field: 'passportIssuedBy', header: 'Ким виданий паспорт', kind: 'text', synonyms: ['ким виданий', 'орган що видав', 'орган, що видав паспорт'], width: 24 },
  { field: 'passportIssuedAt', header: 'Дата видачі паспорта', kind: 'date', synonyms: ['дата видачі', 'коли виданий'], width: 14 },
  { field: 'position', header: 'Посада', kind: 'text', synonyms: ['найменування посади'], width: 24 },
  { field: 'department', header: 'Підрозділ', kind: 'text', synonyms: ['відділ', 'структурний підрозділ'], width: 20 },
  {
    field: 'hireDate',
    header: 'Дата прийняття на роботу',
    kind: 'date',
    synonyms: ['дата прийому', 'дата прийняття', 'дата прийому на роботу', 'прийнятий', 'дата працевлаштування'],
    width: 14,
  },
  { field: 'hireOrderDocName', header: 'Документ про прийняття', kind: 'text', synonyms: ['назва документа про прийняття', 'вид наказу'], width: 14, note: 'наказ / розпорядження (порожньо — наказ)' },
  { field: 'hireOrderNumber', header: 'Номер наказу про прийняття', kind: 'text', synonyms: ['наказ про прийняття', 'номер наказу', 'наказ №'], width: 14 },
  { field: 'hireOrderDate', header: 'Дата наказу про прийняття', kind: 'date', synonyms: ['дата наказу'], width: 14 },
  { field: 'militaryRegistered', header: 'На військовому обліку', kind: 'bool', synonyms: ['перебуває на військовому обліку', 'військовий облік'], width: 12, note: 'так / ні (порожньо — так)' },
  { field: 'servedInArmy', header: 'Проходив військову службу', kind: 'bool', synonyms: ['служив в армії', 'служба в армії', 'проходження військової служби'], width: 13, note: 'так / ні' },
  { field: 'rankCode', header: 'Військове звання', kind: 'rank', synonyms: ['звання'], width: 18, note: 'як у військово-обліковому документі; для призовників — «призовник»' },
  { field: 'vos', header: 'ВОС', kind: 'text', synonyms: ['військово-облікова спеціальність', 'вос номер'], width: 10 },
  { field: 'registryNumber', header: 'Номер у реєстрі «Оберіг»', kind: 'text', synonyms: ['номер в єдр', 'номер у єдр', 'номер облікового запису', 'номер запису в реєстрі', 'оберіг', 'уніс', 'унзр'], width: 16 },
  { field: 'militaryDocType', header: 'Військово-обліковий документ', kind: 'militaryDocType', synonyms: ['вод', 'тип вод', 'тип військово-облікового документа'], width: 22 },
  { field: 'militaryDocSeries', header: 'Серія ВОД', kind: 'upper', synonyms: ['серія військового квитка'], width: 10 },
  { field: 'militaryDocNumber', header: 'Номер ВОД', kind: 'text', synonyms: ['номер військового квитка', 'номер військово-облікового документа'], width: 14 },
  { field: 'militaryDocIssuedBy', header: 'Ким виданий ВОД', kind: 'text', width: 22 },
  { field: 'militaryDocIssuedAt', header: 'Дата видачі ВОД', kind: 'date', width: 14 },
  { field: 'tckId', header: 'ТЦК та СП', kind: 'tck', synonyms: ['тцк', 'ртцк', 'тцк та сп за місцем обліку', 'територіальний центр комплектування'], width: 26, note: 'назва як у довіднику ТЦК (аркуш «Довідка»)' },
  { field: 'fitness', header: 'Придатність', kind: 'text', synonyms: ['придатність до військової служби'], width: 24 },
  { field: 'reserved', header: 'Заброньований', kind: 'bool', synonyms: ['бронювання', 'заброньовано'], width: 13, note: 'так — лише якщо є рішення про бронювання' },
  { field: 'reservationUntil', header: 'Заброньовано до', kind: 'date', synonyms: ['бронювання до', 'строк бронювання'], width: 14 },
  { field: 'deferralUntil', header: 'Відстрочка до', kind: 'date', synonyms: ['строк відстрочки'], width: 14, note: 'дата або «до завершення мобілізації»' },
  { field: 'deferralMobilizationBasis', header: 'Підстава відстрочки', kind: 'text', synonyms: ['відстрочка'], width: 22 },
  { field: 'notes', header: 'Примітки', kind: 'text', synonyms: ['примітка', 'коментар'], width: 20 },
];

/** Lower case, unified apostrophes, no punctuation — for comparing headers and dictionary values. */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’ʼ`'‘]/g, '’')
    .replace(/[«»"().,:;№#*]/g, ' ')
    .replace(/[\s_]+/g, ' ')
    .trim();
}

const HEADER_INDEX = new Map<string, ImportColumn>();
for (const column of IMPORT_COLUMNS) {
  for (const name of [column.header, ...(column.synonyms ?? [])]) HEADER_INDEX.set(normalizeKey(name), column);
}
// the same headers without the apostrophe ("Імя") and with the field name itself
for (const [key, column] of [...HEADER_INDEX]) HEADER_INDEX.set(key.replace(/’/g, ''), column);

export function columnForHeader(header: string): ImportColumn | undefined {
  const key = normalizeKey(header);
  return key ? (HEADER_INDEX.get(key) ?? HEADER_INDEX.get(key.replace(/’/g, ''))) : undefined;
}

export const TEMPLATE_COLUMNS = IMPORT_COLUMNS.filter((c) => !c.extraOnly);
