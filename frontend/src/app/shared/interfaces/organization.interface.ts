import type { Tck } from './dictionary.interface';

/** Parameters shared by all legal entities (GET / PUT /api/organization): terms and mobilization. */
export interface Organization {
  alertDays: number;
  notifyDeadlineDays: number;
  /** General mobilization lasts until (from the presidential decrees). */
  mobilizationUntil?: string | null;
  mobilizationDecree?: string;
  mobilizationSource?: string;
  mobilizationCheckedAt?: string | null;
}

/** The «Строки» card of the settings. */
export interface OrganizationTermsForm {
  alertDays: number;
  notifyDeadlineDays: number;
}

export interface NotificationStatus {
  mailConfigured: boolean;
  recipients: number;
  mobilizationUntil: string | null;
  mobilizationDecree: string;
  mobilizationCheckedAt: string | null;
}

export interface DecreeCheckResult {
  ok: boolean;
  until?: string;
  decree?: string;
  changed?: boolean;
  message?: string;
}

/** The TCK edit form. */
export type TckForm = Pick<Tck, 'name' | 'nameGenitive' | 'address' | 'phone' | 'email'> & {
  postalCode: string;
};

export type TckImportItem = Pick<Tck, 'name'> &
  Partial<Pick<Tck, 'nameGenitive' | 'address' | 'postalCode' | 'phone' | 'email'>>;

/** The «Строк мобілізації» card (manual override). */
export interface OrganizationExtraForm {
  mobilizationUntil: string;
  mobilizationDecree: string;
}

export interface OrganizationSettingsData {
  organization: Organization;
  status: NotificationStatus;
}

/** POST /api/notifications/test */
export interface TestMailResult {
  sent: boolean;
}

/** POST /api/tck/import */
export interface TckImportResult {
  created: number;
  updated: number;
}

/** A TCK export file picked for import, before confirmation. */
export interface PendingTckImport {
  file: string;
  items: TckImportItem[];
}

/** Shape of a TCK export file: an array or { items: [...] }. */
export interface TckImportFile {
  items?: unknown;
}
