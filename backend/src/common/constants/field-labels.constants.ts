import type { ListItemLabels } from '../../shared/interfaces/common.interface.js';

export const ORGANIZATION_LABELS: Record<string, string> = {
  fullName: 'Повна назва',
  nameLocative: 'Назва в місцевому відмінку',
  shortName: 'Скорочена назва',
  edrpou: 'Код ЄДРПОУ',
  address: 'Адреса',
  postalCode: 'Поштовий індекс',
  phone: 'Телефон',
  email: 'Email',
  headPosition: 'Посада керівника',
  headName: 'ПІБ керівника',
  letterNumberPrefix: 'Префікс номера листа',
  alertDays: 'Попереджати за, днів',
  notifyDeadlineDays: 'Строк повідомлення ТЦК, днів',
  reservationQuota: 'Квота бронювання',
  reservationQuotaBasis: 'Підстава квоти',
  mobilizationUntil: 'Мобілізація до',
  mobilizationDecree: 'Указ про мобілізацію',
  notifyEmails: 'Додаткові email для нагадувань',
};

export const HEAD_OR_PERSON_LABELS: Record<string, string> = {
  fullName: 'ПІБ',
  position: 'Посада',
  phone: 'Телефон',
  orderNumber: 'Номер наказу',
  validFrom: 'Діє з',
  validTo: 'Діє до',
};

export const USER_LABELS: Record<string, string> = {
  email: 'Email',
  fullName: 'ПІБ',
  role: 'Роль',
  password: 'Пароль',
  isActive: 'Активний',
  notify: 'Нагадування на email',
};

export const AUTH_LABELS: Record<string, string> = {
  email: 'Email',
  password: 'Пароль',
  currentPassword: 'Поточний пароль',
  newPassword: 'Новий пароль',
};

export const TCK_LABELS: Record<string, string> = {
  name: 'Назва ТЦК',
  nameGenitive: 'Назва в родовому відмінку',
  address: 'Адреса',
  postalCode: 'Поштовий індекс',
  phone: 'Телефон',
  email: 'Email',
  items: 'Записи',
};

/** Fields of the lists inside the employee card (`militaryDocuments.0.number` → «Документ 1 — Номер»). */
export const LIST_ITEM_LABELS: Record<string, ListItemLabels> = {
  militaryDocuments: {
    title: 'Військово-обліковий документ',
    fields: {
      type: 'Тип',
      series: 'Серія',
      number: 'Номер',
      issuedBy: 'Ким виданий',
      issuedAt: 'Дата видачі',
      generatedDate: 'Дата формування',
      generatedTime: 'Час формування',
    },
  },
  familyMembers: {
    title: 'Член сім’ї',
    fields: {
      relation: 'Ступінь спорідненості',
      lastName: 'Прізвище',
      firstName: 'Ім’я',
      middleName: 'По батькові',
      birthDate: 'Дата народження',
    },
  },
  positions: {
    title: 'Посада',
    fields: {
      position: 'Посада',
      department: 'Підрозділ',
      since: 'З дати',
      orderDocName: 'Документ',
      orderNumber: 'Номер',
      orderDate: 'Дата документа',
    },
  },
  educations: {
    title: 'Освіта',
    fields: {
      level: 'Рівень',
      institution: 'Навчальний заклад',
      specialty: 'Спеціальність',
      document: 'Документ',
      documentDate: 'Дата документа',
    },
  },
  changeMeta: { title: 'Зміни', fields: { effectiveDate: 'Діють з', basis: 'Підстава' } },
};

export const LABELS_BY_REQUEST: Record<string, Record<string, string>> = {
  UpdateOrganizationDto: ORGANIZATION_LABELS,
  CreateOrganizationHeadDto: HEAD_OR_PERSON_LABELS,
  UpdateOrganizationHeadDto: HEAD_OR_PERSON_LABELS,
  CreateResponsiblePersonDto: HEAD_OR_PERSON_LABELS,
  UpdateResponsiblePersonDto: HEAD_OR_PERSON_LABELS,
  CreateUserDto: USER_LABELS,
  UpdateUserDto: USER_LABELS,
  LoginDto: AUTH_LABELS,
  ChangePasswordDto: AUTH_LABELS,
  CreateTckDto: TCK_LABELS,
  UpdateTckDto: TCK_LABELS,
  ImportTckDto: TCK_LABELS,
};
