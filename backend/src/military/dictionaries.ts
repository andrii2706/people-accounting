/** Static dictionaries taken from sheet EDU_TCK and the employee card. */

export const EDUCATION_LEVELS = [
  'Повна вища освіта',
  'Базова вища освіта',
  'Неповна вища освіта',
  'Повна загальна середня освіта (ПЗСО)',
  'Базова загальна середня освіта (БЗСО)',
  'Початкова загальна освіта',
] as const;

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';

const MARITAL_LABELS: Record<MaritalStatus, { M: string; F: string }> = {
  SINGLE: { M: 'неодружений', F: 'незаміжня' },
  MARRIED: { M: 'одружений', F: 'заміжня' },
  DIVORCED: { M: 'розлучений', F: 'розлучена' },
  WIDOWED: { M: 'вдівець', F: 'вдова' },
  OTHER: { M: 'інше', F: 'інше' },
};

export function maritalStatusLabel(status: MaritalStatus | null | undefined, gender: 'M' | 'F'): string {
  if (!status) return '';
  return MARITAL_LABELS[status]?.[gender] ?? '';
}

export const MARITAL_STATUSES = (Object.keys(MARITAL_LABELS) as MaritalStatus[]).map((value) => ({
  value,
  labelM: MARITAL_LABELS[value].M,
  labelF: MARITAL_LABELS[value].F,
}));

export const MILITARY_DOCUMENT_TYPES = [
  'військовий квиток',
  'тимчасове посвідчення військовозобов’язаного',
  'посвідчення особи офіцера',
  'посвідчення про приписку до призовної дільниці',
  'військово-обліковий документ в електронній формі',
] as const;

export const FITNESS_STATUSES = [
  'придатний до військової служби',
  'обмежено придатний до військової служби',
  'придатний до служби у військових частинах забезпечення, ТЦК та СП, ВНЗ, навчальних центрах, закладах, установах',
  'тимчасово непридатний до військової служби',
  'непридатний до військової служби з переоглядом',
  'непридатний до військової служби з виключенням з військового обліку',
] as const;

export type FamilyRelation = 'HUSBAND' | 'WIFE' | 'SON' | 'DAUGHTER';

export const FAMILY_RELATION_LABELS: Record<FamilyRelation, string> = {
  HUSBAND: 'чоловік',
  WIFE: 'дружина',
  SON: 'син',
  DAUGHTER: 'донька',
};

/** Types of registration data changes the company notifies the TCK about (employee card, rows 102–114). */
export type ChangeType =
  | 'LAST_NAME'
  | 'FIRST_NAME'
  | 'MIDDLE_NAME'
  | 'POSITION'
  | 'REGISTERED_ADDRESS'
  | 'ACTUAL_ADDRESS'
  | 'PASSPORT'
  | 'FOREIGN_PASSPORT'
  | 'EDUCATION'
  | 'MARITAL_STATUS'
  | 'HIRE'
  | 'DISMISSAL';

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  LAST_NAME: 'Зміна прізвища',
  FIRST_NAME: 'Зміна власного імені',
  MIDDLE_NAME: 'Зміна по батькові',
  POSITION: 'Зміна посади',
  REGISTERED_ADDRESS: 'Зміна зареєстрованого місця проживання',
  ACTUAL_ADDRESS: 'Зміна фактичного місця проживання',
  PASSPORT: 'Заміна внутрішнього паспорта',
  FOREIGN_PASSPORT: 'Отримано закордонний паспорт',
  EDUCATION: 'Здобуто освіту',
  MARITAL_STATUS: 'Зміна сімейного стану',
  HIRE: 'Прийняття на роботу',
  DISMISSAL: 'Звільнення з роботи',
};

/** Groups used for the operational report and statistics (sheets G1…G4R of the Excel file). */
export type ListGroup = 'G1' | 'G1R' | 'G2' | 'G2R' | 'G3' | 'G3R' | 'G4' | 'G4R';

export const LIST_GROUP_TITLES: Record<ListGroup, string> = {
  G1: 'військовозобов’язаних офіцерського складу',
  G1R: 'резервістів офіцерського складу',
  G2: 'військовозобов’язаних рядового, сержантського та старшинського складу',
  G2R: 'резервістів рядового, сержантського та старшинського складу',
  G3: 'військовозобов’язаних з числа жінок',
  G3R: 'резервістів з числа жінок',
  G4: 'призовників',
  G4R: 'призовників, що перебувають в резерві,',
};

export const LIST_GROUPS = Object.keys(LIST_GROUP_TITLES) as ListGroup[];

export type DutyCategory = 'LIABLE' | 'RESERVIST' | 'CONSCRIPT';

export const DUTY_CATEGORY_LABELS: Record<DutyCategory, string> = {
  LIABLE: 'Військовозобов’язаний',
  RESERVIST: 'Резервіст',
  CONSCRIPT: 'Призовник',
};
