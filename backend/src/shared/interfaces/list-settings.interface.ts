import type { IsoDate } from './common.interface.js';
import type { DutyCategory, ListSection } from './dictionary.interface.js';
import type { ListRowView } from './report.interface.js';

/** The 18 columns of the lists (Annex 5) — keys of the cells in their order. */
export type ListColumnKey =
  | 'number'
  | 'category'
  | 'rank'
  | 'fullName'
  | 'birthDate'
  | 'registryNumber'
  | 'taxNumber'
  | 'vos'
  | 'militaryDoc'
  | 'passport'
  | 'address'
  | 'tck'
  | 'deferral'
  | 'reservation'
  | 'served'
  | 'mobilizationOrder'
  | 'position'
  | 'notices';

/** Order of the rows inside a list. */
export type ListSort = 'NAME' | 'RANK' | 'BIRTH_DATE';

/** Sub-headings inside a list. */
export type ListGrouping = 'NONE' | 'CATEGORY' | 'TCK' | 'DEPARTMENT';

export interface ListSigner {
  position: string;
  name: string;
}

/** A Word template uploaded for a list (stored in the storage, never changed). */
export interface ListTemplateInfo {
  key: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

/** How one of the four lists looks: the columns, the order of the rows, the heading, the signers, the template. */
export interface ListSectionSettings {
  /** Shown and printed columns, in this order («number» is always first). */
  columns: ListColumnKey[];
  sort: ListSort;
  groupBy: ListGrouping;
  /** «СПИСКИ» — an empty value means the standard one. */
  title: string;
  /** The line under the title; empty — «персонального військового обліку … , які працюють в …». */
  subtitle: string;
  /** The lines «Вихідний номер / Дата» above the title. */
  showOutgoing: boolean;
  /** Who signs; empty — the head of the legal entity. */
  signers: ListSigner[];
  template: ListTemplateInfo | null;
}

export type ListSettings = Record<ListSection, ListSectionSettings>;

/** Data of one row beyond the printed cells — for sorting and grouping. */
export interface ListRowMeta {
  rankCode: number | null;
  birthDate: IsoDate | null;
  department: string;
}

/** One printed group of a list: the heading (empty — no heading) and the rows of the chosen columns. */
export interface ListLayoutGroup {
  title: string;
  rows: string[][];
}

/** A list laid out by its settings. */
export interface ListLayout {
  columns: ListColumnKey[];
  groups: ListLayoutGroup[];
  count: number;
}

/** A list row for the layout: the 18 cells and the meta. */
export interface LayoutRow {
  cells: string[];
  category: DutyCategory | null;
  meta: ListRowMeta;
}

/** The lists formed on a date — kept as they were («Сформувати»). */
export interface ListSnapshotSummary {
  id: string;
  legalEntityId: string;
  date: IsoDate;
  total: number;
  sections: Record<ListSection, number>;
  createdAt: Date;
  createdByName: string;
}

/** The page of the settings: the four lists and the column titles. */
export interface ListSettingsPage {
  settings: ListSettings;
  /** Placeholders of the Word templates — the reference on the page. */
  placeholders: TemplatePlaceholder[];
}

export interface TemplatePlaceholder {
  tag: string;
  description: string;
}

/** What a Word template of a list receives. */
export interface ListTemplateData {
  title: string;
  subtitle: string;
  whom: string;
  date: string;
  outNumber: string;
  outDate: string;
  extract: boolean;
  org: ListTemplateOrg;
  count: number;
  rows: ListTemplateRow[];
  groups: ListTemplateGroup[];
  signers: ListSigner[];
}

export interface ListTemplateOrg {
  fullName: string;
  shortName: string;
  edrpou: string;
  address: string;
  headPosition: string;
  headName: string;
}

/** One row for a template: every column key → its text, plus «n» (the number in the list). */
export type ListTemplateRow = Record<string, string>;

export interface ListTemplateGroup {
  title: string;
  count: number;
  rows: ListTemplateRow[];
}

/** docxtemplater's inspect module — the part we use. */
export interface TemplateInspector {
  getAllTags(): Record<string, unknown>;
}

/** A lists document: one Word file, or a .zip with a file per list (own templates of several lists). */
export interface RenderedListDocument {
  buffer: Buffer;
  kind: 'docx' | 'zip';
}

/** Formed lists for the page — the shape of the live lists report plus what was formed. */
export interface ListSnapshotReport {
  date: IsoDate;
  rows: ListRowView[];
  counts: Record<DutyCategory, number>;
  snapshot: ListSnapshotSummary;
}

export interface ListSnapshotDocument extends RenderedListDocument {
  date: IsoDate;
}

/** A Word template uploaded through multer. */
export interface UploadedTemplate {
  originalname: string;
  buffer: Buffer;
  size: number;
}
