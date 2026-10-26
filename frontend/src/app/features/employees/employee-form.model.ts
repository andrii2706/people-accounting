import type { Employee, EmployeePayload, FamilyRelation, Gender } from '../../core/api/api.types';

export type FormTab = 'personal' | 'work' | 'military' | 'documents' | 'family' | 'notes';

/**
 * Модель форми: усі значення — рядки/булеві (так з ними нативно працюють інпути Signal Forms),
 * перетворення в DTO — у toPayload().
 */
export interface FamilyMemberForm {
  relation: FamilyRelation;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
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

  position: string;
  department: string;
  positionOrder: string;
  positionSince: string;
  hireDate: string;
  hireOrderNumber: string;
  hireOrderDate: string;

  militaryRegistered: boolean;
  registryNumber: string;
  rankCode: string;
  navy: boolean;
  vos: string;
  trainingProfile: string;
  accountingCategory: string;
  militaryDocType: string;
  militaryDocSeries: string;
  militaryDocNumber: string;
  militaryDocIssuedBy: string;
  militaryDocIssuedAt: string;
  militaryDocGeneratedAt: string;
  tckId: string;
  tckRegisteredAt: string;
  fitness: string;
  fitnessBasis: string;
  fitnessDate: string;
  reservationBasis: string;
  specialAccountingCertificate: string;
  reservationUntil: string;
  deferralConscriptionBasis: string;
  deferralMobilizationBasis: string;
  deferralUntil: string;
  reserveTeamNumber: string;
  mobilizationOrderDate: string;
  militaryServiceInfo: string;
  mobilizedAt: string;
  mobilizationReleaseOrder: string;
  demobilizedAt: string;
  readmissionOrder: string;
  notes: string;

  /** Підстава змін для повідомлення ТЦК. */
  changeEffectiveDate: string;
  changeBasis: string;
}

const DATE_FIELDS = [
  'birthDate', 'passportIssuedAt', 'foreignPassportIssuedAt', 'foreignPassportValidUntil', 'educationDocumentDate',
  'positionSince', 'hireDate', 'hireOrderDate', 'militaryDocIssuedAt', 'tckRegisteredAt', 'fitnessDate',
  'reservationUntil', 'deferralUntil', 'mobilizationOrderDate', 'mobilizedAt', 'demobilizedAt',
] as const satisfies readonly (keyof EmployeeFormModel)[];

export function emptyEmployeeForm(today: string): EmployeeFormModel {
  return {
    personnelNumber: '', gender: 'M', lastName: '', firstName: '', middleName: '', rnokpp: '', birthDate: '',
    phone: '', email: '', registeredAddress: '', actualAddress: '',
    passportType: 'ID_CARD', passportSeries: '', passportNumber: '', passportIssuedBy: '', passportIssuedAt: '',
    foreignPassportSeries: '', foreignPassportNumber: '', foreignPassportIssuedBy: '', foreignPassportIssuedAt: '', foreignPassportValidUntil: '',
    educationLevel: '', educationSpecialty: '', educationDocument: '', educationDocumentDate: '', maritalStatus: '', familyMembers: [],
    position: '', department: '', positionOrder: '', positionSince: '', hireDate: today, hireOrderNumber: '', hireOrderDate: '',
    militaryRegistered: true, registryNumber: '', rankCode: '', navy: false, vos: '', trainingProfile: '', accountingCategory: '',
    militaryDocType: '', militaryDocSeries: '', militaryDocNumber: '', militaryDocIssuedBy: '', militaryDocIssuedAt: '', militaryDocGeneratedAt: '',
    tckId: '', tckRegisteredAt: '', fitness: '', fitnessBasis: '', fitnessDate: '',
    reservationBasis: '', specialAccountingCertificate: '', reservationUntil: '', deferralConscriptionBasis: '', deferralMobilizationBasis: '', deferralUntil: '',
    reserveTeamNumber: '', mobilizationOrderDate: '', militaryServiceInfo: '', mobilizedAt: '', mobilizationReleaseOrder: '', demobilizedAt: '', readmissionOrder: '',
    notes: '', changeEffectiveDate: today, changeBasis: '',
  };
}

export function employeeToForm(e: Employee, today: string): EmployeeFormModel {
  const base = emptyEmployeeForm(today);
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof EmployeeFormModel)[]) {
    if (key === 'changeEffectiveDate' || key === 'changeBasis' || key === 'familyMembers') continue;
    const value = (e as unknown as Record<string, unknown>)[key];
    if (key === 'rankCode') out[key] = value === null || value === undefined ? '' : String(value);
    else if (typeof base[key] === 'boolean') out[key] = Boolean(value);
    else out[key] = value ?? '';
  }
  out['familyMembers'] = (e.familyMembers ?? []).map((m) => ({
    relation: m.relation, lastName: m.lastName, firstName: m.firstName, middleName: m.middleName ?? '', birthDate: m.birthDate ?? '',
  }));
  return out as unknown as EmployeeFormModel;
}

export function formToPayload(model: EmployeeFormModel, includeChangeMeta: boolean): EmployeePayload {
  const { changeEffectiveDate, changeBasis, familyMembers, rankCode, tckId, maritalStatus, ...rest } = model;
  const payload: Record<string, unknown> = { ...rest };
  // нормалізація: серії — великими літерами, у ID-картки серії немає
  payload['passportSeries'] = model.passportType === 'ID_CARD' ? '' : model.passportSeries.trim().toUpperCase();
  payload['foreignPassportSeries'] = model.foreignPassportSeries.trim().toUpperCase();
  payload['militaryDocSeries'] = model.militaryDocSeries.trim().toUpperCase();
  for (const key of DATE_FIELDS) payload[key] = model[key] || null;
  payload['rankCode'] = rankCode === '' ? null : Number(rankCode);
  payload['tckId'] = tckId || null;
  payload['maritalStatus'] = maritalStatus || null;
  payload['familyMembers'] = familyMembers.map((m) => ({ ...m, birthDate: m.birthDate || null }));
  if (includeChangeMeta) payload['changeMeta'] = { effectiveDate: changeEffectiveDate || undefined, basis: changeBasis };
  return payload as EmployeePayload;
}

/** Поля, зміна яких породжує повідомлення ТЦК (дзеркало CHANGE_RULES на бекенді). */
export const REPORTABLE_FIELDS: { label: string; fields: (keyof EmployeeFormModel)[] }[] = [
  { label: 'прізвище', fields: ['lastName'] },
  { label: 'ім’я', fields: ['firstName'] },
  { label: 'по батькові', fields: ['middleName'] },
  { label: 'посада', fields: ['position'] },
  { label: 'зареєстроване місце проживання', fields: ['registeredAddress'] },
  { label: 'фактичне місце проживання', fields: ['actualAddress'] },
  { label: 'паспорт', fields: ['passportType', 'passportSeries', 'passportNumber'] },
  { label: 'закордонний паспорт', fields: ['foreignPassportSeries', 'foreignPassportNumber'] },
  { label: 'освіта', fields: ['educationLevel', 'educationDocument'] },
  { label: 'сімейний стан', fields: ['maritalStatus'] },
];

export function reportableChanges(original: EmployeeFormModel | null, current: EmployeeFormModel): string[] {
  if (!original) return [];
  const changed = REPORTABLE_FIELDS.filter((r) => r.fields.some((f) => original[f] !== current[f])).map((r) => r.label);
  const familyChanged = JSON.stringify(original.familyMembers) !== JSON.stringify(current.familyMembers);
  if (familyChanged && !changed.includes('сімейний стан')) changed.push('склад сім’ї');
  return changed;
}

/**
 * Де живе кожне поле (вкладка) і як воно називається — для навігації до помилки
 * та зрозумілого списку помилок. Порядок = порядок перевірки при збереженні.
 */
export const FIELD_META: Partial<Record<keyof EmployeeFormModel | 'familyMembers', { tab: FormTab | 'sidebar'; label: string }>> = {
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

  position: { tab: 'work', label: 'Посада' },
  department: { tab: 'work', label: 'Підрозділ' },
  hireDate: { tab: 'work', label: 'Дата прийняття' },
  hireOrderNumber: { tab: 'work', label: 'Наказ про прийняття №' },
  hireOrderDate: { tab: 'work', label: 'Дата наказу' },
  positionSince: { tab: 'work', label: 'Посада з дати' },
  positionOrder: { tab: 'work', label: 'Акт про призначення' },

  militaryRegistered: { tab: 'military', label: 'Перебуває на обліку' },
  rankCode: { tab: 'military', label: 'Військове звання' },
  navy: { tab: 'military', label: 'Корабельні звання' },
  vos: { tab: 'military', label: 'ВОС' },
  accountingCategory: { tab: 'military', label: 'Категорія обліку / розряд' },
  trainingProfile: { tab: 'military', label: 'Профіль підготовки' },
  registryNumber: { tab: 'military', label: 'Реєстраційний номер ЄДР' },
  tckId: { tab: 'military', label: 'ТЦК та СП' },
  tckRegisteredAt: { tab: 'military', label: 'На обліку з' },
  militaryDocType: { tab: 'military', label: 'Тип військового документа' },
  militaryDocSeries: { tab: 'military', label: 'Серія військового документа' },
  militaryDocNumber: { tab: 'military', label: 'Номер військового документа' },
  militaryDocIssuedAt: { tab: 'military', label: 'Дата видачі військового документа' },
  militaryDocIssuedBy: { tab: 'military', label: 'Ким виданий військовий документ' },
  militaryDocGeneratedAt: { tab: 'military', label: 'Час і дата формування е-документа' },
  fitness: { tab: 'military', label: 'Придатність' },
  fitnessDate: { tab: 'military', label: 'Дата ВЛК' },
  fitnessBasis: { tab: 'military', label: 'Графа, пункт наказу' },
  deferralConscriptionBasis: { tab: 'military', label: 'Відстрочка від строкової служби' },
  reservationBasis: { tab: 'military', label: 'Бронювання' },
  reservationUntil: { tab: 'military', label: 'Заброньовано до' },
  specialAccountingCertificate: { tab: 'military', label: '№ посвідчення' },
  deferralMobilizationBasis: { tab: 'military', label: 'Відстрочка від мобілізації' },
  deferralUntil: { tab: 'military', label: 'Відстрочка до' },
  reserveTeamNumber: { tab: 'military', label: '№ команди (резерв)' },
  mobilizationOrderDate: { tab: 'military', label: 'Мобілізаційне розпорядження' },
  mobilizedAt: { tab: 'military', label: 'Дата мобілізації' },
  mobilizationReleaseOrder: { tab: 'military', label: 'Наказ про увільнення' },
  demobilizedAt: { tab: 'military', label: 'Дата демобілізації' },
  readmissionOrder: { tab: 'military', label: 'Наказ про допуск' },
  militaryServiceInfo: { tab: 'military', label: 'Відомості про службу' },

  passportType: { tab: 'documents', label: 'Тип паспорта' },
  passportSeries: { tab: 'documents', label: 'Серія паспорта' },
  passportNumber: { tab: 'documents', label: 'Номер паспорта' },
  passportIssuedAt: { tab: 'documents', label: 'Дата видачі паспорта' },
  passportIssuedBy: { tab: 'documents', label: 'Ким виданий паспорт' },
  foreignPassportSeries: { tab: 'documents', label: 'Серія закордонного паспорта' },
  foreignPassportNumber: { tab: 'documents', label: 'Номер закордонного паспорта' },
  foreignPassportIssuedAt: { tab: 'documents', label: 'Дата видачі закордонного паспорта' },
  foreignPassportValidUntil: { tab: 'documents', label: 'Закордонний паспорт дійсний до' },
  foreignPassportIssuedBy: { tab: 'documents', label: 'Ким виданий закордонний паспорт' },
  educationLevel: { tab: 'documents', label: 'Рівень освіти' },
  educationSpecialty: { tab: 'documents', label: 'Спеціальність' },
  educationDocument: { tab: 'documents', label: 'Документ про освіту' },
  educationDocumentDate: { tab: 'documents', label: 'Дата видачі документа про освіту' },

  maritalStatus: { tab: 'family', label: 'Сімейний стан' },
  familyMembers: { tab: 'family', label: 'Члени сім’ї' },

  notes: { tab: 'notes', label: 'Примітки' },

  changeEffectiveDate: { tab: 'sidebar', label: 'Зміни діють з' },
  changeBasis: { tab: 'sidebar', label: 'Підстава змін' },
};

/** Шлях помилки з API (напр. "familyMembers.0.lastName", "changeMeta.basis") → поле форми. */
export function apiPathToFormPath(path: string): string[] {
  if (path === 'changeMeta.effectiveDate') return ['changeEffectiveDate'];
  if (path === 'changeMeta.basis') return ['changeBasis'];
  return path.split('.');
}
