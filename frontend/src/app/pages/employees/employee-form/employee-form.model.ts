import type { Gender } from '../../../shared/interfaces/common.interface';
import type { FamilyRelation } from '../../../shared/interfaces/dictionary.interface';
import type { Employee, EmployeePayload } from '../../../shared/interfaces/employee.interface';

export type FormTab =
  'personal' | 'passport' | 'education' | 'family' | 'work' | 'military' | 'notes';

/**
 * Form model: all values are strings/booleans (that is how Signal Forms inputs work natively),
 * conversion to the DTO happens in formToPayload().
 */
export interface FamilyMemberForm {
  relation: FamilyRelation;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

/** One military registration document; date and time of generation are separate fields. */
export interface MilitaryDocumentForm {
  type: string;
  series: string;
  number: string;
  issuedBy: string;
  issuedAt: string;
  generatedDate: string;
  generatedTime: string;
}

/** One position in the company (appointment or transfer). */
export interface PositionForm {
  position: string;
  department: string;
  since: string;
  orderDocName: string;
  orderNumber: string;
  orderDate: string;
}

export interface EmployeeFormModel {
  personnelNumber: string;
  gender: Gender;
  lastName: string;
  firstName: string;
  middleName: string;
  rnokpp: string;
  birthDate: string;
  phone: string;
  email: string;
  registeredAddress: string;
  actualAddress: string;

  passportType: 'ID_CARD' | 'BOOK';
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedAt: string;
  foreignPassportSeries: string;
  foreignPassportNumber: string;
  foreignPassportIssuedBy: string;
  foreignPassportIssuedAt: string;
  foreignPassportValidUntil: string;

  educationLevel: string;
  educationSpecialty: string;
  educationDocument: string;
  educationDocumentDate: string;
  maritalStatus: string;
  familyMembers: FamilyMemberForm[];

  hireDate: string;
  hireOrderDocName: string;
  hireOrderNumber: string;
  hireOrderDate: string;
  positions: PositionForm[];
  dismissalDate: string;
  dismissalOrderDocName: string;
  dismissalOrderNumber: string;
  dismissalOrderDate: string;

  militaryRegistered: boolean;
  registryNumber: string;
  rankCode: string;
  navy: boolean;
  vos: string;
  trainingProfile: string;
  accountingCategory: string;
  servedInArmy: boolean;
  militaryDocuments: MilitaryDocumentForm[];
  tckId: string;
  tckRegisteredAt: string;
  fitness: string;
  fitnessBasis: string;
  fitnessDate: string;
  reserved: boolean;
  reservedBy: 'COMPANY' | 'OTHER';
  reservedByName: string;
  reservedByEdrpou: string;
  specialAccountingCertificate: string;
  reservationUntil: string;
  deferralConscriptionBasis: string;
  deferralMobilizationBasis: string;
  deferralUntil: string;
  deferralUntilMobilizationEnd: boolean;
  reserveTeamNumber: string;
  mobilizationOrderDate: string;
  militaryServiceInfo: string;
  mobilizedAt: string;
  mobilizationReleaseOrder: string;
  demobilizedAt: string;
  readmissionOrder: string;
  notes: string;

  /** Grounds of the changes for the TCK notice. */
  changeEffectiveDate: string;
  changeBasis: string;
}

export const DATE_FIELDS = [
  'birthDate',
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'foreignPassportValidUntil',
  'educationDocumentDate',
  'hireDate',
  'hireOrderDate',
  'dismissalDate',
  'dismissalOrderDate',
  'tckRegisteredAt',
  'fitnessDate',
  'reservationUntil',
  'deferralUntil',
  'mobilizationOrderDate',
  'mobilizedAt',
  'demobilizedAt',
] as const satisfies readonly (keyof EmployeeFormModel)[];

/** Array fields — converted separately. */
const LIST_FIELDS = new Set(['familyMembers', 'militaryDocuments', 'positions']);

export const emptyDocument = (): MilitaryDocumentForm => ({
  type: '',
  series: '',
  number: '',
  issuedBy: '',
  issuedAt: '',
  generatedDate: '',
  generatedTime: '',
});

export const emptyPosition = (since = ''): PositionForm => ({
  position: '',
  department: '',
  since,
  orderDocName: 'наказ',
  orderNumber: '',
  orderDate: '',
});

export function emptyEmployeeForm(today: string): EmployeeFormModel {
  return {
    personnelNumber: '',
    gender: 'M',
    lastName: '',
    firstName: '',
    middleName: '',
    rnokpp: '',
    birthDate: '',
    phone: '',
    email: '',
    registeredAddress: '',
    actualAddress: '',
    passportType: 'ID_CARD',
    passportSeries: '',
    passportNumber: '',
    passportIssuedBy: '',
    passportIssuedAt: '',
    foreignPassportSeries: '',
    foreignPassportNumber: '',
    foreignPassportIssuedBy: '',
    foreignPassportIssuedAt: '',
    foreignPassportValidUntil: '',
    educationLevel: '',
    educationSpecialty: '',
    educationDocument: '',
    educationDocumentDate: '',
    maritalStatus: '',
    familyMembers: [],
    hireDate: today,
    hireOrderDocName: 'наказ',
    hireOrderNumber: '',
    hireOrderDate: '',
    // the first entry is the position the person is hired for
    positions: [emptyPosition()],
    dismissalDate: '',
    dismissalOrderDocName: 'наказ',
    dismissalOrderNumber: '',
    dismissalOrderDate: '',
    militaryRegistered: true,
    registryNumber: '',
    rankCode: '',
    navy: false,
    vos: '',
    trainingProfile: '',
    accountingCategory: '',
    servedInArmy: false,
    militaryDocuments: [emptyDocument()],
    tckId: '',
    tckRegisteredAt: '',
    fitness: '',
    fitnessBasis: '',
    fitnessDate: '',
    reserved: false,
    reservedBy: 'COMPANY',
    reservedByName: '',
    reservedByEdrpou: '',
    specialAccountingCertificate: '',
    reservationUntil: '',
    deferralConscriptionBasis: '',
    deferralMobilizationBasis: '',
    deferralUntil: '',
    deferralUntilMobilizationEnd: false,
    reserveTeamNumber: '',
    mobilizationOrderDate: '',
    militaryServiceInfo: '',
    mobilizedAt: '',
    mobilizationReleaseOrder: '',
    demobilizedAt: '',
    readmissionOrder: '',
    notes: '',
    changeEffectiveDate: today,
    changeBasis: '',
  };
}

export function employeeToForm(e: Employee, today: string): EmployeeFormModel {
  const base = emptyEmployeeForm(today);
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof EmployeeFormModel)[]) {
    if (key === 'changeEffectiveDate' || key === 'changeBasis' || LIST_FIELDS.has(key)) continue;
    const value = (e as unknown as Record<string, unknown>)[key];
    if (key === 'rankCode') out[key] = value === null || value === undefined ? '' : String(value);
    else if (typeof base[key] === 'boolean') out[key] = Boolean(value);
    else out[key] = value ?? '';
  }
  out['familyMembers'] = (e.familyMembers ?? []).map((m) => ({
    relation: m.relation,
    lastName: m.lastName,
    firstName: m.firstName,
    middleName: m.middleName ?? '',
    birthDate: m.birthDate ?? '',
  }));
  out['militaryDocuments'] = (e.militaryDocuments ?? []).map((d) => ({
    type: d.type ?? '',
    series: d.series ?? '',
    number: d.number ?? '',
    issuedBy: d.issuedBy ?? '',
    issuedAt: d.issuedAt ?? '',
    generatedDate: d.generatedDate ?? '',
    generatedTime: d.generatedTime ?? '',
  }));
  const positions = (e.positions ?? []).map((p) => ({
    position: p.position,
    department: p.department ?? '',
    since: p.since ?? '',
    orderDocName: p.orderDocName ?? '',
    orderNumber: p.orderNumber ?? '',
    orderDate: p.orderDate ?? '',
  }));
  // cards created before the positions history: the current position is the first entry
  out['positions'] = positions.length
    ? positions
    : e.position
      ? [
          {
            ...emptyPosition(e.positionSince ?? e.hireDate ?? ''),
            position: e.position,
            department: e.department ?? '',
            orderNumber: e.hireOrderNumber ?? '',
            orderDate: e.hireOrderDate ?? '',
          },
        ]
      : [emptyPosition()];
  if (!e.hireOrderDocName) out['hireOrderDocName'] = 'наказ';
  if (!e.dismissalOrderDocName) out['dismissalOrderDocName'] = 'наказ';
  return out as unknown as EmployeeFormModel;
}

export function formToPayload(
  model: EmployeeFormModel,
  includeChangeMeta: boolean,
): EmployeePayload {
  const {
    changeEffectiveDate,
    changeBasis,
    familyMembers,
    militaryDocuments,
    positions,
    rankCode,
    tckId,
    maritalStatus,
    ...rest
  } = model;
  const payload: Record<string, unknown> = { ...rest };
  // normalization: series in upper case, an ID card has no series
  payload['passportSeries'] =
    model.passportType === 'ID_CARD' ? '' : model.passportSeries.trim().toUpperCase();
  payload['foreignPassportSeries'] = model.foreignPassportSeries.trim().toUpperCase();
  for (const key of DATE_FIELDS) payload[key] = model[key] || null;
  payload['rankCode'] = rankCode === '' ? null : Number(rankCode);
  payload['tckId'] = tckId || null;
  payload['maritalStatus'] = maritalStatus || null;
  payload['familyMembers'] = familyMembers.map((m) => ({ ...m, birthDate: m.birthDate || null }));
  payload['militaryDocuments'] = militaryDocuments
    .filter((d) => d.type || d.number || d.series)
    .map((d) => ({
      ...d,
      series: d.series.trim().toUpperCase(),
      number: d.number.trim(),
      issuedAt: d.issuedAt || null,
      generatedDate: d.generatedDate || null,
      generatedTime: normalizeTime(d.generatedTime),
    }));
  payload['positions'] = positions
    .filter((p) => p.position.trim())
    .map((p) => ({ ...p, since: p.since || null, orderDate: p.orderDate || null }));
  // reservation data is sent only when "Заброньований" is chosen (never for conscripts)
  if (!model.reserved || rankCode === '0') {
    payload['reserved'] = false;
    payload['specialAccountingCertificate'] = '';
    payload['reservationUntil'] = null;
    payload['reservedBy'] = 'COMPANY';
    payload['reservedByName'] = '';
    payload['reservedByEdrpou'] = '';
  } else if (model.reservedBy !== 'OTHER') {
    payload['reservedByName'] = '';
    payload['reservedByEdrpou'] = '';
  }
  if (model.deferralUntilMobilizationEnd) payload['deferralUntil'] = null;
  // dismissal fields are sent only together with the date
  if (!model.dismissalDate) {
    payload['dismissalOrderDocName'] = '';
    payload['dismissalOrderNumber'] = '';
    payload['dismissalOrderDate'] = null;
  }
  if (includeChangeMeta)
    payload['changeMeta'] = { effectiveDate: changeEffectiveDate || undefined, basis: changeBasis };
  return payload as EmployeePayload;
}

const docsKey = (m: EmployeeFormModel) =>
  JSON.stringify(m.militaryDocuments.filter((d) => d.type || d.number || d.series));
const positionKey = (m: EmployeeFormModel) => {
  const current = [...m.positions]
    .filter((p) => p.position.trim())
    .sort((a, b) => a.since.localeCompare(b.since))
    .at(-1);
  return current?.position.trim() ?? '';
};

/**
 * Registration data whose change produces a TCK notice (mirror of CHANGE_RULES on the backend):
 * all of them go into one notice «зміна облікових даних».
 */
export const REPORTABLE: { label: string; key: (m: EmployeeFormModel) => string }[] = [
  { label: 'прізвище', key: (m) => m.lastName },
  { label: 'ім’я', key: (m) => m.firstName },
  { label: 'по батькові', key: (m) => m.middleName },
  { label: 'посада', key: positionKey },
  { label: 'зареєстроване місце проживання', key: (m) => m.registeredAddress },
  { label: 'фактичне місце проживання', key: (m) => m.actualAddress },
  { label: 'паспорт', key: (m) => [m.passportType, m.passportSeries, m.passportNumber].join('|') },
  { label: 'номер у реєстрі', key: (m) => m.registryNumber },
  { label: 'військове звання', key: (m) => `${m.rankCode}|${m.navy}` },
  { label: 'ВОС', key: (m) => m.vos },
  { label: 'військово-обліковий документ', key: docsKey },
  { label: 'ТЦК', key: (m) => m.tckId },
  { label: 'придатність', key: (m) => `${m.fitness}|${m.fitnessBasis}` },
  { label: 'військова служба', key: (m) => `${m.servedInArmy}|${m.mobilizedAt}` },
  {
    label: 'відстрочка',
    key: (m) =>
      [
        m.deferralConscriptionBasis,
        m.deferralMobilizationBasis,
        m.deferralUntil,
        m.deferralUntilMobilizationEnd,
      ].join('|'),
  },
  {
    label: 'бронювання',
    key: (m) =>
      m.reserved
        ? [
            m.reservationUntil,
            m.specialAccountingCertificate,
            m.reservedBy,
            m.reservedByName,
            m.reservedByEdrpou,
          ].join('|')
        : '',
  },
  { label: 'служба в резерві', key: (m) => m.reserveTeamNumber },
  { label: 'мобілізаційне розпорядження', key: (m) => m.mobilizationOrderDate },
];

export function reportableChanges(
  original: EmployeeFormModel | null,
  current: EmployeeFormModel,
): string[] {
  if (!original) return [];
  return REPORTABLE.filter((r) => r.key(original) !== r.key(current)).map((r) => r.label);
}

/**
 * Where each field lives (tab) and what it is called — for navigating to an error
 * and a readable list of errors. The order = validation order on save.
 */
export const FIELD_META: Partial<
  Record<keyof EmployeeFormModel, { tab: FormTab | 'sidebar'; label: string }>
> = {
  lastName: { tab: 'personal', label: 'Прізвище' },
  firstName: { tab: 'personal', label: 'Ім’я' },
  middleName: { tab: 'personal', label: 'По батькові' },
  gender: { tab: 'personal', label: 'Стать' },
  birthDate: { tab: 'personal', label: 'Дата народження' },
  rnokpp: { tab: 'personal', label: 'РНОКПП' },
  personnelNumber: { tab: 'personal', label: 'Табельний номер' },
  phone: { tab: 'personal', label: 'Телефон' },
  email: { tab: 'personal', label: 'Email' },
  registeredAddress: { tab: 'personal', label: 'Зареєстроване місце проживання' },
  actualAddress: { tab: 'personal', label: 'Фактичне місце проживання' },

  passportType: { tab: 'passport', label: 'Тип паспорта' },
  passportSeries: { tab: 'passport', label: 'Серія паспорта' },
  passportNumber: { tab: 'passport', label: 'Номер паспорта' },
  passportIssuedAt: { tab: 'passport', label: 'Дата видачі паспорта' },
  passportIssuedBy: { tab: 'passport', label: 'Ким виданий паспорт' },
  foreignPassportSeries: { tab: 'passport', label: 'Серія закордонного паспорта' },
  foreignPassportNumber: { tab: 'passport', label: 'Номер закордонного паспорта' },
  foreignPassportIssuedAt: { tab: 'passport', label: 'Дата видачі закордонного паспорта' },
  foreignPassportValidUntil: { tab: 'passport', label: 'Закордонний паспорт дійсний до' },
  foreignPassportIssuedBy: { tab: 'passport', label: 'Ким виданий закордонний паспорт' },

  educationLevel: { tab: 'education', label: 'Рівень освіти' },
  educationSpecialty: { tab: 'education', label: 'Спеціальність' },
  educationDocument: { tab: 'education', label: 'Документ про освіту' },
  educationDocumentDate: { tab: 'education', label: 'Дата видачі документа про освіту' },

  maritalStatus: { tab: 'family', label: 'Сімейний стан' },
  familyMembers: { tab: 'family', label: 'Члени сім’ї' },

  hireDate: { tab: 'work', label: 'Дата прийняття' },
  hireOrderDocName: { tab: 'work', label: 'Назва документа про вступ на посаду' },
  hireOrderNumber: { tab: 'work', label: 'Номер документа про прийняття' },
  hireOrderDate: { tab: 'work', label: 'Дата документа про прийняття' },
  positions: { tab: 'work', label: 'Посади' },
  dismissalDate: { tab: 'work', label: 'Дата звільнення' },
  dismissalOrderDocName: { tab: 'work', label: 'Документ про звільнення' },
  dismissalOrderNumber: { tab: 'work', label: 'Номер документа про звільнення' },
  dismissalOrderDate: { tab: 'work', label: 'Дата документа про звільнення' },

  militaryRegistered: { tab: 'military', label: 'Перебуває на обліку' },
  rankCode: { tab: 'military', label: 'Військове звання' },
  navy: { tab: 'military', label: 'Корабельні звання' },
  vos: { tab: 'military', label: 'ВОС' },
  accountingCategory: { tab: 'military', label: 'Категорія обліку / розряд' },
  trainingProfile: { tab: 'military', label: 'Склад (профіль підготовки)' },
  servedInArmy: { tab: 'military', label: 'Проходив військову службу' },
  registryNumber: { tab: 'military', label: 'Номер у реєстрі «Оберіг»' },
  militaryDocuments: { tab: 'military', label: 'Військово-облікові документи' },
  tckId: { tab: 'military', label: 'ТЦК та СП' },
  tckRegisteredAt: { tab: 'military', label: 'На обліку з' },
  fitness: { tab: 'military', label: 'Придатність' },
  fitnessDate: { tab: 'military', label: 'Дата ВЛК' },
  fitnessBasis: { tab: 'military', label: 'Графа, пункт наказу' },
  reserved: { tab: 'military', label: 'Заброньований' },
  reservedBy: { tab: 'military', label: 'Ким заброньовано' },
  reservedByName: { tab: 'military', label: 'Юридична особа' },
  reservedByEdrpou: { tab: 'military', label: 'ЄДРПОУ юридичної особи' },
  reservationUntil: { tab: 'military', label: 'Заброньовано до' },
  specialAccountingCertificate: { tab: 'military', label: '№ посвідчення' },
  deferralConscriptionBasis: { tab: 'military', label: 'Відстрочка від строкової служби' },
  deferralMobilizationBasis: { tab: 'military', label: 'Відстрочка від мобілізації' },
  deferralUntil: { tab: 'military', label: 'Відстрочка до' },
  reserveTeamNumber: { tab: 'military', label: '№ команди (резерв)' },
  mobilizationOrderDate: { tab: 'military', label: 'Мобілізаційне розпорядження' },
  mobilizedAt: { tab: 'military', label: 'Дата мобілізації' },
  mobilizationReleaseOrder: { tab: 'military', label: 'Наказ про увільнення' },
  demobilizedAt: { tab: 'military', label: 'Дата демобілізації' },
  readmissionOrder: { tab: 'military', label: 'Наказ про допуск' },
  militaryServiceInfo: { tab: 'military', label: 'Відомості про службу' },

  notes: { tab: 'notes', label: 'Примітки' },

  changeEffectiveDate: { tab: 'sidebar', label: 'Зміни діють з' },
  changeBasis: { tab: 'sidebar', label: 'Підстава змін' },
};

/** Sub-fields of the list fields (for the «what to fix» list). */
export const LIST_ITEM_FIELDS: Record<
  'familyMembers' | 'militaryDocuments' | 'positions',
  { item: string; fields: string[] }
> = {
  familyMembers: {
    item: 'Член сім’ї',
    fields: ['lastName', 'firstName', 'middleName', 'birthDate'],
  },
  militaryDocuments: {
    item: 'Військово-обліковий документ',
    fields: ['type', 'series', 'number', 'issuedAt', 'generatedDate', 'generatedTime'],
  },
  positions: { item: 'Посада', fields: ['position', 'since', 'orderNumber', 'orderDate'] },
};

/** API error path (e.g. "familyMembers.0.lastName", "changeMeta.basis") → form field. */
export function apiPathToFormPath(path: string): string[] {
  if (path === 'changeMeta.effectiveDate') return ['changeEffectiveDate'];
  if (path === 'changeMeta.basis') return ['changeBasis'];
  return path.split('.');
}

/** «1015», «10.15», «9:05» → «10:15» / «09:05»; anything else is returned as typed (validation explains). */
export function normalizeTime(value: string): string {
  const v = value.trim();
  const m = /^(\d{1,2})[:.\s]?(\d{2})$/.exec(v);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : v;
}
