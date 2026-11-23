import type { IsoDate } from './common.interface.js';
import type { ChangeType, ListSection } from './dictionary.interface.js';
import type { ListLayout, ListSectionSettings, ListSigner } from './list-settings.interface.js';
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

/** One entry of the list of presidential decrees (president.gov.ua/documents/decrees). */
export interface DecreeListItem {
  /** The page of the decree. */
  url: string;
  /** «1061/2026». */
  number: string;
  /** The date of signing; null — not found next to the entry. */
  date: IsoDate | null;
  /** The text of the entry: number, date, title. */
  text: string;
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

/**
 * A part of the reconciliation package: the cover letter with the inventory of its attachments (cover),
 * the inventory for the post office, form 107 (inventory), or a .zip of four files — with the extract and the
 * envelope label (all).
 */
export type ReconciliationPart = 'cover' | 'inventory' | 'all';

/** A person of the extract: listed in the cover letter; his eВОД goes as an attachment. */
export interface ReconciliationPerson {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: IsoDate | null;
  /** The electronic document from «Резерв+», when it is in the card. */
  evod: { number: string; generatedDate: IsoDate | null; generatedTime: string } | null;
}

/** One line of an inventory: what and how many copies. */
export interface InventoryItem {
  name: string;
  copies: number;
  /** Sheets of one copy, if known (eВОД — 1); empty — left for the pen. */
  sheets?: string;
}

/** Cover letter and inventory for extracts (or lists) sent to a TCK for reconciliation. */
export interface ReconciliationInput {
  letter: { number: string; date: IsoDate };
  /** The declared value of every line of form 107, грн (the label settings of the legal entity). */
  declaredValue?: number;
  /** «станом на» of the extracts */
  reportDate: IsoDate;
  tck: Tck | null;
  org: Organization;
  responsible: ResponsibleInfo | null;
  /** Extracts about the people of the TCK (true) or the whole lists (false). */
  extract: boolean;
  /**
   * The lists in the package with the number of people in each (empty ones are left out) and the sheets of one
   * copy (null — unknown, a blank for the pen).
   */
  sections: { section: ListSection; people: number; sheets?: number | null }[];
  /** The people of the extract, in the order of the lists. */
  people: ReconciliationPerson[];
  part: Exclude<ReconciliationPart, 'all'>;
}

export interface ListsInput {
  date: IsoDate;
  extract: boolean;
  /** The four lists (officers, soldiers, women, conscripts) laid out by their settings. */
  sections: ListDocumentSection[];
  org: Organization;
  letter?: LetterNumberDate | null;
}

/** One list of the built-in document: the rows by the settings and who signs. */
export interface ListDocumentSection {
  section: ListSection;
  layout: ListLayout;
  settings: ListSectionSettings;
  signers: ListSigner[];
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
  /** The address in one line, in the order of the Rules (without the index). */
  address: string;
  /** The same address a line each: the street with the house, the settlement, the district, the region. */
  addressLines?: string[];
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
  items: (string | InventoryItem)[];
  /** The declared value of every line, грн (the label settings of the legal entity); 0 — left for the pen. */
  declaredValue?: number;
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

/** A cell for the estimate of pages: its text and size, points. */
export interface PageEstimateCell {
  text: string;
  size: number;
  colSpan?: number;
}

/** A block of text outside the table (a heading line, a signature), with its height in twips. */
export interface PageEstimateBlock {
  height: number;
}

/** A document of a text, a table with repeating header rows and a text after it — for the estimate of pages. */
export interface PageEstimateInput {
  /** The height of the text area of a page, twips. */
  pageHeight: number;
  /** The widths of the columns of the table, twips. */
  widths: number[];
  before: PageEstimateBlock[];
  header: PageEstimateCell[][];
  rows: PageEstimateCell[][];
  after: PageEstimateBlock[];
}
