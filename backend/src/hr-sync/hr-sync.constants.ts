import type { HrMilitaryPolicy, HrSyncMode, HrSystem, ODataProfile } from '../shared/interfaces/hr-sync.interface.js';

export const HR_SYSTEMS: readonly HrSystem[] = ['ZUP', 'BAS_ACCOUNTING', 'OTHER'];
export const HR_MODES: readonly HrSyncMode[] = ['PUSH', 'ODATA', 'FILE'];
export const HR_MILITARY_POLICIES: readonly HrMilitaryPolicy[] = ['FILL_EMPTY', 'OVERWRITE', 'IGNORE'];

/** Where 1C sends the employees (the address of the API is added by the page: …/oblik/api or …/api). */
export const HR_PUSH_PATH = 'api/integrations/1c/employees';
/** Pushes of one key per minute — 1C sends a big company in parts of HR_MAX_RECORDS_PER_PUSH. */
export const HR_PUSHES_PER_MINUTE = 30;

/** The push key: «mr1c_<8 hex of the prefix>_<43 base64url of the secret>». */
export const HR_TOKEN_PREFIX = 'mr1c_';
export const HR_TOKEN_PATTERN = /^mr1c_([0-9a-f]{8})_([A-Za-z0-9_-]{43})$/;

/** One push carries at most this many people (the body limit of the API is 2 MB) — 1C sends in parts. */
export const HR_MAX_RECORDS_PER_PUSH = 500;
/** One OData read takes at most this many employees (a bigger company — ask for a dedicated setup). */
export const HR_MAX_RECORDS_PER_READ = 5000;

/** Deliveries are kept this long (the review page, the history), then deleted by the daily job. */
export const HR_BATCH_KEEP_DAYS = 30;
/** Rows of the history on the settings page. */
export const HR_HISTORY_ROWS = 20;

export const ODATA_TIMEOUT_MS = 30_000;
/** A reply of 1C bigger than this is refused — protects the API from an endless answer. */
export const ODATA_MAX_BYTES = 50 * 1024 * 1024;
export const ODATA_PAGE_SIZE = 1000;
/** The standard OData address of a published 1C base. */
export const ODATA_SUFFIX = '/odata/standard.odata';

/** Who is shown in the journal of the card and in the TCK queue for automatic runs. */
export const HR_ACTOR_NAME = 'Інтеграція з 1С';

export const HR_SYSTEM_LABELS = {
  ZUP: '1С / BAS: Зарплата і управління персоналом',
  BAS_ACCOUNTING: 'BAS Бухгалтерія / Комплексне',
  OTHER: 'Інша система (M.E.Doc, власна)',
} as const;

/** Labels of the fields in the review of a delivery. */
export const HR_FIELD_LABELS: Record<string, string> = {
  personnelNumber: 'Табельний номер',
  lastName: 'Прізвище',
  firstName: 'Ім’я',
  middleName: 'По батькові',
  gender: 'Стать',
  birthDate: 'Дата народження',
  rnokpp: 'РНОКПП',
  phone: 'Телефон',
  email: 'Email',
  registeredAddress: 'Адреса реєстрації',
  actualAddress: 'Фактична адреса',
  passportType: 'Тип паспорта',
  passportSeries: 'Серія паспорта',
  passportNumber: 'Номер паспорта',
  passportIssuedBy: 'Ким виданий паспорт',
  passportIssuedAt: 'Дата видачі паспорта',
  position: 'Посада',
  department: 'Підрозділ',
  hireDate: 'Дата прийняття',
  hireOrderNumber: 'Наказ про прийняття',
  hireOrderDate: 'Дата наказу про прийняття',
  dismissalDate: 'Дата звільнення',
  militaryRegistered: 'Військовий облік',
  servedInArmy: 'Проходив службу',
  rankCode: 'Військове звання',
  navy: 'Корабельне звання',
  vos: 'ВОС',
  registryNumber: 'Обліковий номер',
  tckId: 'ТЦК та СП',
  fitness: 'Придатність',
  fitnessDate: 'Дата ВЛК',
  militaryDocuments: 'Військово-обліковий документ',
  externalId: 'Код у 1С',
};

/** Personnel fields: 1C is the source — a filled value from 1C replaces ours. */
export const HR_PERSONNEL_FIELDS = [
  'personnelNumber',
  'lastName',
  'firstName',
  'middleName',
  'gender',
  'birthDate',
  'rnokpp',
  'phone',
  'email',
  'registeredAddress',
  'actualAddress',
  'passportType',
  'passportSeries',
  'passportNumber',
  'passportIssuedBy',
  'passportIssuedAt',
  'hireDate',
  'hireOrderNumber',
  'hireOrderDate',
] as const;

/** Military fields: by the policy of the settings (fill the empty ones / replace / ignore). */
export const HR_MILITARY_FIELDS = [
  'militaryRegistered',
  'servedInArmy',
  'rankCode',
  'navy',
  'vos',
  'registryNumber',
  'tckId',
  'fitness',
  'fitnessDate',
] as const;

/** The flat document fields of the import → one military document. */
export const HR_DOC_FIELDS = [
  'militaryDocType',
  'militaryDocSeries',
  'militaryDocNumber',
  'militaryDocIssuedBy',
  'militaryDocIssuedAt',
] as const;

/**
 * The tables of 1C configurations as published over OData. Names follow the language of the configuration
 * (Russian in 1С:ЗУП для України, Ukrainian in the newer BAS), so every field has candidates; the reader takes
 * the first one the publication actually has ($metadata). A field that is not found stays empty.
 */
export const ODATA_PROFILES: readonly ODataProfile[] = [
  {
    id: 'ZUP_RU',
    title: 'ЗУП / BAS ЗУП (назви російською)',
    system: 'ZUP',
    employees: 'Catalog_Сотрудники',
    persons: 'Catalog_ФизическиеЛица',
    organizations: 'Catalog_Организации',
    positions: 'Catalog_Должности',
    departments: 'Catalog_ПодразделенияОрганизаций',
    staff: 'InformationRegister_ТекущиеКадровыеДанныеСотрудников',
    names: 'InformationRegister_ФИОФизическихЛиц',
    fields: {
      employeeCode: ['Code'],
      employeeName: ['Description'],
      employeePerson: ['ФизическоеЛицо_Key'],
      employeeOrganization: ['ГоловнаяОрганизация_Key', 'Организация_Key'],
      employeeArchived: ['ВАрхиве'],
      staffEmployee: ['Сотрудник_Key'],
      staffOrganization: ['ТекущаяОрганизация_Key', 'Организация_Key'],
      staffPosition: ['ТекущаяДолжность_Key', 'Должность_Key'],
      staffDepartment: ['ТекущееПодразделение_Key', 'Подразделение_Key'],
      staffHireDate: ['ДатаПриема'],
      staffDismissalDate: ['ДатаУвольнения'],
      personBirthDate: ['ДатаРождения'],
      personGender: ['Пол'],
      personTaxId: ['КодПоДРФО', 'ИНН', 'КодДРФО'],
      namesPerson: ['ФизическоеЛицо_Key'],
      namesLast: ['Фамилия'],
      namesFirst: ['Имя'],
      namesMiddle: ['Отчество'],
      organizationCode: ['КодПоЕДРПОУ', 'КодПоЄДРПОУ', 'ЕДРПОУ', 'КодЕДРПОУ'],
    },
  },
  {
    id: 'ZUP_UA',
    title: 'BAS ЗУП (назви українською)',
    system: 'ZUP',
    employees: 'Catalog_Працівники',
    persons: 'Catalog_ФізичніОсоби',
    organizations: 'Catalog_Організації',
    positions: 'Catalog_Посади',
    departments: 'Catalog_ПідрозділиОрганізацій',
    staff: 'InformationRegister_ПоточніКадровіДаніПрацівників',
    names: 'InformationRegister_ПІБФізичнихОсіб',
    fields: {
      employeeCode: ['Code'],
      employeeName: ['Description'],
      employeePerson: ['ФізичнаОсоба_Key'],
      employeeOrganization: ['ГоловнаОрганізація_Key', 'Організація_Key'],
      employeeArchived: ['ВАрхіві'],
      staffEmployee: ['Працівник_Key'],
      staffOrganization: ['ПоточнаОрганізація_Key', 'Організація_Key'],
      staffPosition: ['ПоточнаПосада_Key', 'Посада_Key'],
      staffDepartment: ['ПоточнийПідрозділ_Key', 'Підрозділ_Key'],
      staffHireDate: ['ДатаПрийому', 'ДатаПрийняття'],
      staffDismissalDate: ['ДатаЗвільнення'],
      personBirthDate: ['ДатаНародження'],
      personGender: ['Стать'],
      personTaxId: ['КодЗаДРФО', 'РНОКПП', 'КодДРФО'],
      namesPerson: ['ФізичнаОсоба_Key'],
      namesLast: ['Прізвище'],
      namesFirst: ['Імя', 'Ім_я', 'Ім’я'],
      namesMiddle: ['ПоБатькові'],
      organizationCode: ['КодЗаЄДРПОУ', 'КодПоЄДРПОУ', 'ЄДРПОУ'],
    },
  },
  {
    id: 'BAS_ACC_RU',
    title: 'BAS Бухгалтерія / Бухгалтерія для України (назви російською)',
    system: 'BAS_ACCOUNTING',
    employees: 'Catalog_СотрудникиОрганизаций',
    persons: 'Catalog_ФизическиеЛица',
    organizations: 'Catalog_Организации',
    positions: 'Catalog_ДолжностиОрганизаций',
    departments: 'Catalog_ПодразделенияОрганизаций',
    // the current personnel data are on the employee itself
    staff: '',
    names: 'InformationRegister_ФИОФизЛиц',
    fields: {
      employeeCode: ['Code'],
      employeeName: ['Description'],
      employeePerson: ['Физлицо_Key', 'ФизическоеЛицо_Key'],
      employeeOrganization: ['Организация_Key'],
      employeeActive: ['Актуальность'],
      employeePosition: ['Должность_Key'],
      employeeDepartment: ['ПодразделениеОрганизации_Key'],
      employeeHireDate: ['ДатаПриемаНаРаботу'],
      employeeDismissalDate: ['ДатаУвольнения'],
      personBirthDate: ['ДатаРождения'],
      personGender: ['Пол'],
      personTaxId: ['КодПоДРФО', 'ИНН'],
      namesPerson: ['ФизЛицо_Key', 'ФизическоеЛицо_Key'],
      namesLast: ['Фамилия'],
      namesFirst: ['Имя'],
      namesMiddle: ['Отчество'],
      organizationCode: ['КодПоЕДРПОУ', 'ЕДРПОУ'],
    },
  },
  {
    id: 'BAS_ACC_UA',
    title: 'BAS Бухгалтерія (назви українською)',
    system: 'BAS_ACCOUNTING',
    employees: 'Catalog_ПрацівникиОрганізацій',
    persons: 'Catalog_ФізичніОсоби',
    organizations: 'Catalog_Організації',
    positions: 'Catalog_ПосадиОрганізацій',
    departments: 'Catalog_ПідрозділиОрганізацій',
    staff: '',
    names: 'InformationRegister_ПІБФізОсіб',
    fields: {
      employeeCode: ['Code'],
      employeeName: ['Description'],
      employeePerson: ['ФізОсоба_Key', 'ФізичнаОсоба_Key'],
      employeeOrganization: ['Організація_Key'],
      employeeActive: ['Актуальність'],
      employeePosition: ['Посада_Key'],
      employeeDepartment: ['ПідрозділОрганізації_Key'],
      employeeHireDate: ['ДатаПрийомуНаРоботу', 'ДатаПрийняттяНаРоботу'],
      employeeDismissalDate: ['ДатаЗвільнення'],
      personBirthDate: ['ДатаНародження'],
      personGender: ['Стать'],
      personTaxId: ['КодЗаДРФО', 'РНОКПП'],
      namesPerson: ['ФізОсоба_Key', 'ФізичнаОсоба_Key'],
      namesLast: ['Прізвище'],
      namesFirst: ['Імя', 'Ім_я'],
      namesMiddle: ['ПоБатькові'],
      organizationCode: ['КодЗаЄДРПОУ', 'ЄДРПОУ'],
    },
  },
];

/** 1C writes an empty date as the year 1. */
export const ODATA_EMPTY_DATE = '0001-01-01';
/** 1C writes an empty reference as the nil GUID. */
export const ODATA_EMPTY_REF = '00000000-0000-0000-0000-000000000000';
