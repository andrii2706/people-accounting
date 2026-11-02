export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';

export type FamilyRelation = 'HUSBAND' | 'WIFE' | 'SON' | 'DAUGHTER';

/**
 * Types of registration data changes the company notifies the TCK about (employee card, rows 102–114).
 * A notice is one of three kinds: hiring, dismissal, or a change of registration data —
 * all pending data changes of a person go into one notice (type DATA).
 */
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
  | 'REGISTRY_NUMBER'
  | 'RANK'
  | 'VOS'
  | 'MILITARY_DOC'
  | 'TCK'
  | 'FITNESS'
  | 'MILITARY_SERVICE'
  | 'DEFERRAL'
  | 'RESERVATION'
  | 'RESERVE_SERVICE'
  | 'MOBILIZATION_ORDER'
  | 'DATA'
  | 'HIRE'
  | 'DISMISSAL';

/** Groups used for the operational report and statistics (sheets G1…G4R of the Excel file). */
export type ListGroup = 'G1' | 'G1R' | 'G2' | 'G2R' | 'G3' | 'G3R' | 'G4' | 'G4R';

/**
 * The personal registration lists are kept as four separate lists; reservists go into the list
 * of their composition together with persons liable for military service.
 */
export type ListSection = 'OFFICERS' | 'SOLDIERS' | 'WOMEN' | 'CONSCRIPTS';

export type DutyCategory = 'LIABLE' | 'RESERVIST' | 'CONSCRIPT';

export type CompositionKey =
  | 'CONSCRIPT'
  | 'PRIVATE'
  | 'JUNIOR_NCO'
  | 'SENIOR_NCO'
  | 'HIGHER_NCO'
  | 'JUNIOR_OFFICER'
  | 'SENIOR_OFFICER'
  | 'HIGHER_OFFICER';

export interface RankDef {
  code: number;
  army: string;
  navy: string;
  /** Age limit for staying on military registration (EDU_TCK!Q). */
  ageLimit: number;
  composition: CompositionKey;
}

/**
 * ТЦК та СП по всій Україні (крім Львівської області — вона в seed.ts з файлу обліку).
 * Зібрано 31.10.2026 з: довідника телефонів і email ТЦК Міноборони (04.11.2025), ArmyInform, сайтів ОВА/ОДА,
 * міських рад і довідкових переліків. Адреси частини ТЦК — з неофіційних джерел: перевіряйте перед надсиланням.
 * Порожнє поле = дані не знайдено в джерелах (нічого не вигадано). Окуповані території — лише назва й контакти.
 */
export interface TckSeed {
  region: string;
  name: string;
  nameGenitive: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  source: string;
}

export interface TckEntry {
  name: string;
  nameGenitive: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
}

export type TckLevel = 'O' | 'R' | 'M';

export interface ParsedTckName {
  /** Stem of the distinguishing adjective: «шевченківськ», «личаківськ», «київськ». */
  adj: string | null;
  level: TckLevel | null;
  /** Number of the «відділ» (department) or null for the TCK itself. */
  dept: number | null;
  /** Stem of the city: «льво», «киов». */
  city: string | null;
}
