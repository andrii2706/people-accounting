import type { IsoDate } from './common.interface.js';
import type { ChangeType, ListSection } from './dictionary.interface.js';
import type { Tck } from '../../dictionaries/tck.entity.js';
import type { Organization } from '../../organization/organization.entity.js';
import type { LetterNumberDate } from './letter.interface.js';
/** What the system knows about the mobilization term (organization row). */
export interface MobilizationState {
  until: IsoDate | null;
  /** The last date confirmed by a decree (or entered by hand). */
  confirmedUntil: IsoDate | null;
  decree: string;
  /** The term was extended by 90 days automatically — the decree is still awaited. */
  estimated: boolean;
}

/** The result of a check: the new state and what happened (null — nothing). */
export interface MobilizationUpdate {
  state: MobilizationState;
  event: 'decree' | 'confirmed' | 'estimated' | null;
}

export interface MobilizationTerm {
  /** Start of the latest extension. */
  from: IsoDate;
  days: number;
  until: IsoDate;
  /** «№ 597/2026 від 13.07.2026», when the text names the decree. */
  decree: string;
}

export interface PersonName {
  lastName: string;
  firstName: string;
  middleName?: string;
  gender: 'M' | 'F';
}

export interface NoticeSnapshot {
  lastName: string;
  firstName: string;
  middleName: string;
  gender: 'M' | 'F';
  birthDate: string | null;
  registryNumber: string;
  militaryDoc: string;
  vos: string;
  rank: string;
  conscript: boolean;
  tckName: string;
  registeredAddress: string;
  actualAddress: string;
  /** Item 7 — human-readable description of the change. */
  change: string;
  /** Item 8 — grounds for the change. */
  basis: string;
}

export interface TextOpts {
  size?: number;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: number;
  spacingAfter?: number;
  spacingBefore?: number;
  keepNext?: boolean;
  /** Times New Roman by default. */
  font?: string;
}

export interface CellSpec {
  text: string;
  bold?: boolean;
  align?: TextOpts['align'];
  size?: number;
  colSpan?: number;
  /** Keep this row on the same page as the next one (e.g. two-tier records). */
  keepNext?: boolean;
}

/** Size of a page in twips, as it lies when printed (an envelope is wider than high). */
export interface PageSize {
  width: number;
  height: number;
}

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface NoticeItem extends NoticeSnapshot {
  sequence: number;
  changeType: ChangeType;
}

export interface ChangeNoticeInput {
  letter: { number: string; date: IsoDate };
  /** Addressee of the cover letter. */
  tck: Tck | null;
  notices: NoticeItem[];
  org: Organization;
  responsible: ResponsibleInfo | null;
}

export interface ListsInput {
  date: IsoDate;
  extract: boolean;
  /** The four lists (officers, soldiers, women, conscripts); every row has 18 cells (see military/personal-list.ts). */
  sections: { section: ListSection; rows: string[][] }[];
  org: Organization;
  letter?: LetterNumberDate | null;
}

export interface OperationalRowData {
  code: string;
  title: string;
  total: number;
  mobilizationOrders: number;
  reserved: number;
  other: number;
  hiredSince2020: number;
  dismissedSince2020: number;
}

export interface OperationalInput {
  date: IsoDate;
  rows: OperationalRowData[];
  org: Organization;
  responsible: ResponsibleInfo | null;
  letter?: { number: string; date: IsoDate } | null;
}

export interface LabelParty {
  name: string;
  address: string;
  postalCode: string;
  phone: string;
}

export interface EnvelopeLabel {
  sender: LabelParty;
  recipient: LabelParty;
}

/** Inventory of the envelope contents (form 107). */
export interface InventoryInput {
  org: Organization;
  tck: Tck | null | undefined;
  items: string[];
}

/** The operational report rows on a date. */
export interface OperationalReportData {
  date: IsoDate;
  rows: OperationalRowData[];
}

/** The executor in the documents: the person responsible for military registration of the legal entity. */
export interface ResponsibleInfo {
  fullName: string;
  position: string;
  phone: string;
}
