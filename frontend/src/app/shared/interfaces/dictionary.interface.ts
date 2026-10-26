import type { Option } from './common.interface';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';

export type FamilyRelation = 'HUSBAND' | 'WIFE' | 'SON' | 'DAUGHTER';

export type ListGroup = 'G1' | 'G1R' | 'G2' | 'G2R' | 'G3' | 'G3R' | 'G4' | 'G4R';

export type DutyCategory = 'LIABLE' | 'RESERVIST' | 'CONSCRIPT';

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

export interface Tck {
  id: string;
  name: string;
  nameGenitive: string;
  address: string;
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
  dutyCategories: Option<DutyCategory>[];
}
