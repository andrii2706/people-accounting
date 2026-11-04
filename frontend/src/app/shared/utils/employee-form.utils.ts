import type { Employee, EmployeePayload } from '../interfaces/employee.interface';
import { isElectronicDocType, normalizeVos } from '../validators/employee-rules';
import type {
  MilitaryDocumentForm,
  EducationForm,
  PositionForm,
  EmployeeFormModel,
  ReportableField,
} from '../interfaces/employee-form.interface';
import { DATE_FIELDS } from '../constants/employee-form.constants';

/** Array fields — converted separately. */
const LIST_FIELDS = new Set(['familyMembers', 'militaryDocuments', 'positions', 'educations']);

export const emptyDocument = (): MilitaryDocumentForm => ({
  type: '',
  series: '',
  number: '',
  issuedBy: '',
  issuedAt: '',
  generatedDate: '',
  generatedTime: '',
});

export const emptyEducation = (): EducationForm => ({
  level: '',
  institution: '',
  specialty: '',
  document: '',
  documentDate: '',
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
    educations: [emptyEducation()],
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
    legalEntityId: '',
    tckRegisteredAt: '',
    fitness: '',
    fitnessBasis: '',
    fitnessDate: '',
    nextVlkDate: '',
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
    deferralKind: 'NONE',
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

/**
 * New card prefilled from an existing employee («Копіювати») — a full copy of all fields and lists;
 * the user changes what differs before saving. Only the dismissal is not copied: a new card is a working employee.
 */
export function copyEmployeeToForm(e: Employee, today: string): EmployeeFormModel {
  const copy = employeeToForm(e, today);
  const empty = emptyEmployeeForm(today);
  return {
    ...copy,
    dismissalDate: empty.dismissalDate,
    dismissalOrderDocName: empty.dismissalOrderDocName,
    dismissalOrderNumber: empty.dismissalOrderNumber,
    dismissalOrderDate: empty.dismissalOrderDate,
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
  const educations = (e.educations ?? []).map((d) => ({
    level: d.level ?? '',
    institution: d.institution ?? '',
    specialty: d.specialty ?? '',
    document: d.document ?? '',
    documentDate: d.documentDate ?? '',
  }));
  // cards created before the educations list: the education fields of the card are the first entry
  out['educations'] = educations.length
    ? educations
    : e.educationLevel || e.educationSpecialty || e.educationDocument
      ? [
          {
            level: e.educationLevel ?? '',
            institution: '',
            specialty: e.educationSpecialty ?? '',
            document: e.educationDocument ?? '',
            documentDate: e.educationDocumentDate ?? '',
          },
        ]
      : [emptyEducation()];
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
  out['deferralKind'] = e.deferralMobilizationBasis
    ? 'MOBILIZATION'
    : e.deferralConscriptionBasis
      ? 'CONSCRIPTION'
      : 'NONE';
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
    educations,
    rankCode,
    tckId,
    legalEntityId,
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
  payload['vos'] = normalizeVos(model.vos);
  payload['tckId'] = tckId || null;
  // omitted when empty: the server takes the only legal entity (or asks to choose one)
  if (legalEntityId) payload['legalEntityId'] = legalEntityId;
  payload['maritalStatus'] = maritalStatus || null;
  payload['familyMembers'] = familyMembers.map((m) => ({ ...m, birthDate: m.birthDate || null }));
  payload['militaryDocuments'] = militaryDocuments
    .filter((d) => d.type || d.number || d.series)
    .map((d) => ({
      ...d,
      series: isElectronicDocType(d.type) ? '' : d.series.trim().toUpperCase(),
      number: isElectronicDocType(d.type) ? '' : d.number.trim(),
      issuedAt: d.issuedAt || null,
      generatedDate: d.generatedDate || null,
      generatedTime: normalizeTime(d.generatedTime),
    }));
  // the card fields of the highest education are filled in by the server from this list
  payload['educations'] = educations
    .filter((d) => d.level || d.institution.trim() || d.specialty.trim() || d.document.trim())
    .map((d) => ({
      level: d.level,
      institution: d.institution.trim(),
      specialty: d.specialty.trim(),
      document: d.document.trim(),
      documentDate: d.documentDate || null,
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
    // reserved by the company — the other legal entity's details are not needed
    payload['reservedByName'] = '';
    payload['reservedByEdrpou'] = '';
  }
  delete payload['deferralKind'];
  Object.assign(payload, effectiveDeferral(model));
  // the next ВЛК is kept only together with a deferral
  if (!hasDeferral(model)) payload['nextVlkDate'] = null;
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

/** Deferral as it will be saved: nothing when reserved, only the fields of the chosen kind. */
export function effectiveDeferral(m: EmployeeFormModel) {
  const kind = m.reserved ? 'NONE' : m.deferralKind;
  const untilEnd = kind === 'MOBILIZATION' && m.deferralUntilMobilizationEnd;
  return {
    deferralConscriptionBasis: kind === 'CONSCRIPTION' ? m.deferralConscriptionBasis.trim() : '',
    deferralMobilizationBasis: kind === 'MOBILIZATION' ? m.deferralMobilizationBasis.trim() : '',
    deferralUntil: kind === 'NONE' || untilEnd ? null : m.deferralUntil || null,
    deferralUntilMobilizationEnd: untilEnd,
  };
}

/** A deferral will be saved (any kind, the employee is not reserved). */
export function hasDeferral(m: EmployeeFormModel): boolean {
  const d = effectiveDeferral(m);
  return !!(
    d.deferralConscriptionBasis ||
    d.deferralMobilizationBasis ||
    d.deferralUntil ||
    d.deferralUntilMobilizationEnd
  );
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
const REPORTABLE: ReportableField[] = [
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
    key: (m) => {
      const d = effectiveDeferral(m);
      return [
        d.deferralConscriptionBasis,
        d.deferralMobilizationBasis,
        d.deferralUntil ?? '',
        d.deferralUntilMobilizationEnd,
      ].join('|');
    },
  },
  {
    label: 'бронювання',
    key: (m) =>
      m.reserved
        ? [
            m.reservedBy,
            m.reservationUntil,
            m.specialAccountingCertificate,
            m.reservedBy === 'OTHER' ? m.reservedByName : '',
            m.reservedBy === 'OTHER' ? m.reservedByEdrpou : '',
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
