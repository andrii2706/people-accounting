import type { ListSection } from './dictionary.interface';
import type { ListsReport } from './report.interface';

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

/** A Word template uploaded for a list. */
export interface ListTemplateInfo {
  key: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

/** How one of the four lists looks. */
export interface ListSectionSettings {
  /** Printed columns in this order («number» is always first). */
  columns: ListColumnKey[];
  sort: ListSort;
  groupBy: ListGrouping;
  /** Empty — «СПИСКИ». */
  title: string;
  /** Empty — the standard line under the title. */
  subtitle: string;
  showOutgoing: boolean;
  /** Empty — the head of the legal entity. */
  signers: ListSigner[];
  template: ListTemplateInfo | null;
}

/** PUT /api/legal-entities/:id/list-settings/:section — the template is uploaded separately. */
export type ListSectionSettingsBody = Omit<ListSectionSettings, 'template'>;

export type ListSettings = Record<ListSection, ListSectionSettings>;

/** A tag that a Word template may use. */
export interface TemplatePlaceholder {
  tag: string;
  description: string;
}

export interface ListSettingsPage {
  settings: ListSettings;
  placeholders: TemplatePlaceholder[];
}

/** The list settings page: the settings and the legal entity they belong to. */
export interface ListSettingsPageData extends ListSettingsPage {
  entityId: string;
  entityName: string;
}

/** Lists formed by a user («Сформувати»). */
export interface ListSnapshotSummary {
  id: string;
  legalEntityId: string;
  /** «Станом на». */
  date: string;
  total: number;
  sections: Record<ListSection, number>;
  createdAt: string;
  createdByName: string;
}

/** GET /api/reports/lists/snapshots/:id — the formed lists in the shape of the report. */
export interface ListSnapshotReport extends ListsReport {
  snapshot: ListSnapshotSummary;
}

/** The lists page: the history of the formed lists and the chosen one (none — nothing formed yet). */
export interface ListsPageData {
  snapshots: ListSnapshotSummary[];
  report: ListSnapshotReport | null;
}

/** A column with its title and number in the form. */
export interface ListColumnOption {
  value: ListColumnKey;
  label: string;
  /** Column number in the form (1–18). */
  form: number;
}
