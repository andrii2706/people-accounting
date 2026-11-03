import type { ImportEditField } from '../interfaces/employee-import.interface';

/** Fields editable on the preview — the most common ones plus any field that came from the file or has an error. */
export const IMPORT_EDIT_FIELDS: ImportEditField[] = [
  { key: 'lastName', label: 'Прізвище', kind: 'text' },
  { key: 'firstName', label: 'Ім’я', kind: 'text' },
  { key: 'middleName', label: 'По батькові', kind: 'text' },
  { key: 'gender', label: 'Стать', kind: 'gender' },
  { key: 'birthDate', label: 'Дата народження', kind: 'date' },
  { key: 'rnokpp', label: 'РНОКПП', kind: 'text' },
  { key: 'personnelNumber', label: 'Табельний номер', kind: 'text' },
  { key: 'phone', label: 'Телефон', kind: 'text' },
  { key: 'email', label: 'Email', kind: 'text' },
  { key: 'registeredAddress', label: 'Адреса реєстрації', kind: 'text' },
  { key: 'actualAddress', label: 'Фактична адреса', kind: 'text' },
  { key: 'passportType', label: 'Тип паспорта', kind: 'passportType' },
  { key: 'passportSeries', label: 'Серія паспорта', kind: 'text' },
  { key: 'passportNumber', label: 'Номер паспорта', kind: 'text' },
  { key: 'passportIssuedBy', label: 'Ким виданий паспорт', kind: 'text' },
  { key: 'passportIssuedAt', label: 'Дата видачі паспорта', kind: 'date' },
  { key: 'position', label: 'Посада', kind: 'text' },
  { key: 'department', label: 'Підрозділ', kind: 'text' },
  { key: 'hireDate', label: 'Дата прийняття', kind: 'date' },
  { key: 'hireOrderDocName', label: 'Документ про прийняття', kind: 'text' },
  { key: 'hireOrderNumber', label: 'Наказ про прийняття №', kind: 'text' },
  { key: 'hireOrderDate', label: 'Дата наказу', kind: 'date' },
  { key: 'militaryRegistered', label: 'На військовому обліку', kind: 'bool' },
  { key: 'servedInArmy', label: 'Проходив військову службу', kind: 'bool' },
  { key: 'rankCode', label: 'Військове звання', kind: 'rank' },
  { key: 'vos', label: 'ВОС', kind: 'text' },
  { key: 'registryNumber', label: 'Номер у реєстрі «Оберіг»', kind: 'text' },
  { key: 'militaryDocType', label: 'Військово-обліковий документ', kind: 'docType' },
  { key: 'militaryDocSeries', label: 'Серія ВОД', kind: 'text' },
  { key: 'militaryDocNumber', label: 'Номер ВОД', kind: 'text' },
  { key: 'militaryDocIssuedBy', label: 'Ким виданий ВОД', kind: 'text' },
  { key: 'militaryDocIssuedAt', label: 'Дата видачі ВОД', kind: 'date' },
  { key: 'tckId', label: 'ТЦК та СП', kind: 'tck' },
  { key: 'fitness', label: 'Придатність', kind: 'text' },
  { key: 'fitnessDate', label: 'Дата проходження ВЛК', kind: 'date' },
  { key: 'nextVlkDate', label: 'Дата наступного ВЛК', kind: 'date' },
  { key: 'reserved', label: 'Заброньований', kind: 'bool' },
  { key: 'reservationUntil', label: 'Заброньовано до', kind: 'date' },
  { key: 'deferralUntil', label: 'Відстрочка до', kind: 'date' },
  {
    key: 'deferralUntilMobilizationEnd',
    label: 'Відстрочка до завершення мобілізації',
    kind: 'bool',
  },
  { key: 'deferralMobilizationBasis', label: 'Підстава відстрочки', kind: 'text' },
  { key: 'notes', label: 'Примітки', kind: 'text' },
];

/** Always shown in the row editor, even when empty. */
export const IMPORT_ALWAYS_SHOWN = new Set([
  'lastName',
  'firstName',
  'middleName',
  'gender',
  'birthDate',
  'rnokpp',
  'position',
  'hireDate',
  'rankCode',
  'tckId',
]);

/** Import: hiring notices are queued for hire dates within this many days back (as on the server). */
export const IMPORT_RECENT_NOTICE_DAYS = 30;
