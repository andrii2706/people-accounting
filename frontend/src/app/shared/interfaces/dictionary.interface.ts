import type { Option } from './common.interface';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';

export type FamilyRelation = 'HUSBAND' | 'WIFE' | 'SON' | 'DAUGHTER';

export type ListGroup = 'G1' | 'G1R' | 'G2' | 'G2R' | 'G3' | 'G3R' | 'G4' | 'G4R';

export type DutyCategory = 'LIABLE' | 'RESERVIST' | 'CONSCRIPT';

/** The four personal registration lists (reservists go with their composition). */
export type ListSection = 'OFFICERS' | 'SOLDIERS' | 'WOMEN' | 'CONSCRIPTS';

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

export interface Tck {
  id: string;
  name: string;
  nameGenitive: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface Rank {
  code: number;
  army: string;
  navy: string;
  ageLimit: number;
  composition: string;
  compositionLabel: string;
}

export interface Dictionaries {
  ranks: Rank[];
  educationLevels: string[];
  maritalStatuses: { value: MaritalStatus; labelM: string; labelF: string }[];
  militaryDocumentTypes: string[];
  fitnessStatuses: string[];
  familyRelations: Option<FamilyRelation>[];
  changeTypes: Option<ChangeType>[];
  listGroups: Option<ListGroup>[];
  listSections: Option<ListSection>[];
  dutyCategories: Option<DutyCategory>[];
}
