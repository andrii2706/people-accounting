/**
 * Human-readable history of an employee card: field names instead of technical keys,
 * dates as ДД.ММ.РРРР, ranks / TCKs by name, «так / ні» for checkboxes.
 */
import { formatUa, isIsoDate } from '../common/utils/dates.js';
import { maritalStatusLabel } from '../military/dictionaries.js';
import { rankTitle } from '../military/ranks.js';
import type { AuditLog } from './entities/audit-log.entity.js';

export const FIELD_LABELS: Record<string, string> = {
  fullName: 'ПІБ',
  source: 'Джерело',
  personnelNumber: 'Табельний номер',
  gender: 'Стать',
  lastName: 'Прізвище',
  firstName: 'Ім’я',
  middleName: 'По батькові',
  rnokpp: 'РНОКПП',
  birthDate: 'Дата народження',
  phone: 'Телефон',
  email: 'Email',
  registeredAddress: 'Адреса реєстрації',
  actualAddress: 'Фактична адреса',
  passportType: 'Тип паспорта',
  passportSeries: 'Серія паспорта',
  passportNumber: 'Номер паспорта',
  passportIssuedBy: 'Ким виданий паспорт',
  passportIssuedAt: 'Дата видачі паспорта',
  foreignPassportSeries: 'Серія закордонного паспорта',
  foreignPassportNumber: 'Номер закордонного паспорта',
  foreignPassportIssuedBy: 'Ким виданий закордонний паспорт',
  foreignPassportIssuedAt: 'Дата видачі закордонного паспорта',
  foreignPassportValidUntil: 'Закордонний паспорт дійсний до',
  educationLevel: 'Освіта',
  educationSpecialty: 'Спеціальність',
  educationDocument: 'Документ про освіту',
  educationDocumentDate: 'Дата документа про освіту',
  educations: 'Освіта (усі документи)',
  maritalStatus: 'Сімейний стан',
  familyMembers: 'Склад сім’ї',
  positions: 'Посади (місця роботи)',
  position: 'Посада',
  department: 'Підрозділ',
  positionOrder: 'Наказ про призначення на посаду',
  positionSince: 'На посаді з',
  hireDate: 'Дата прийняття',
  hireOrderDocName: 'Документ про прийняття',
  hireOrderNumber: 'Номер наказу про прийняття',
  hireOrderDate: 'Дата наказу про прийняття',
  dismissalDate: 'Дата звільнення',
  dismissalOrderDocName: 'Документ про звільнення',
  dismissalOrderNumber: 'Номер наказу про звільнення',
  dismissalOrderDate: 'Дата наказу про звільнення',
  militaryRegistered: 'На військовому обліку',
  registryNumber: 'Номер у реєстрі «Оберіг»',
  rankCode: 'Військове звання',
  navy: 'Корабельний склад (ВМС)',
  vos: 'ВОС',
  trainingProfile: 'Склад (профіль підготовки)',
  accountingCategory: 'Категорія обліку / розряд',
  militaryDocuments: 'Військово-облікові документи',
  servedInArmy: 'Проходив військову службу',
  tckId: 'ТЦК та СП',
  tckRegisteredAt: 'На обліку в ТЦК з',
  fitness: 'Придатність',
  fitnessBasis: 'Графа, пункт наказу',
  fitnessDate: 'Дата ВЛК',
  reserved: 'Заброньований',
  reservationBasis: 'Підстава бронювання',
  reservationUntil: 'Заброньовано до',
  reservedBy: 'Ким заброньовано',
  reservedByName: 'Юридична особа, що забронювала',
  reservedByEdrpou: 'ЄДРПОУ юридичної особи',
  specialAccountingCertificate: '№ посвідчення (спецоблік)',
  deferralConscriptionBasis: 'Відстрочка від строкової служби',
  deferralMobilizationBasis: 'Відстрочка від мобілізації',
  deferralUntil: 'Відстрочка до',
  deferralUntilMobilizationEnd: 'Відстрочка до завершення мобілізації',
  reserveTeamNumber: 'Служба в резерві — № команди',
  mobilizationOrderDate: 'Мобілізаційне розпорядження від',
  militaryServiceInfo: 'Відомості про військову службу',
  mobilizedAt: 'Дата мобілізації',
  mobilizationReleaseOrder: 'Наказ про увільнення',
  demobilizedAt: 'Дата демобілізації',
  readmissionOrder: 'Наказ про допуск до роботи',
  notes: 'Примітки',
  dismissalBasis: 'Підстава звільнення',
};

export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Створено картку',
  UPDATE: 'Змінено дані',
  DISMISS: 'Звільнено',
  DELETE: 'Видалено',
  VIEW: 'Переглянуто',
  EXPORT: 'Вивантажено',
};

export interface HistoryEntry {
  id: string;
  action: string;
  actionLabel: string;
  userName: string;
  createdAt: Date;
  changes: { field: string; label: string; from: string; to: string }[];
}

export function historyEntries(rows: AuditLog[], tckNames: Map<string, string>, gender: 'M' | 'F'): HistoryEntry[] {
  const format = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'так' : 'ні';
    if (field === 'gender') return v === 'F' ? 'жіноча' : 'чоловіча';
    if (field === 'passportType') return v === 'BOOK' ? 'книжечка' : 'ID-картка';
    if (field === 'rankCode') return rankTitle(Number(v)) || String(v);
    if (field === 'tckId') return tckNames.get(String(v)) ?? 'інший ТЦК';
    if (field === 'reservedBy') return v === 'OTHER' ? 'інша юридична особа' : 'підприємство';
    if (field === 'maritalStatus') return maritalStatusLabel(v as never, gender) || String(v);
    if (typeof v === 'string' && isIsoDate(v)) return formatUa(v);
    return String(v);
  };
  return rows
    .filter((r) => r.action !== 'VIEW')
    .map((r) => ({
      id: r.id,
      action: r.action,
      actionLabel: ACTION_LABELS[r.action] ?? r.action,
      userName: r.userName,
      createdAt: r.createdAt,
      changes: Object.entries(r.diff ?? {}).map(([field, [from, to]]) => ({
        field,
        label: FIELD_LABELS[field] ?? field,
        from: format(field, from),
        to: format(field, to),
      })),
    }));
}
