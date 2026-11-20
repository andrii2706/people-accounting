/** Which accounting system the employees come from (decides the tables read over OData). */
export type HrSystem = 'ZUP' | 'BAS_ACCOUNTING' | 'OTHER';

/**
 * How the data arrive:
 *  PUSH  — 1C (a scheduled task of the data processor from docs/1c) sends them to our endpoint with a key;
 *  ODATA — we read the published 1C base over its standard OData interface;
 *  FILE  — someone exports a file from 1C and imports it by hand (Працівники → Імпорт).
 */
export type HrSyncMode = 'PUSH' | 'ODATA' | 'FILE';

/**
 * How often: ONCE — a single initial load (after the first applied delivery the integration closes);
 * ONGOING — daily and by hand.
 */
export type HrSyncFrequency = 'ONCE' | 'ONGOING';

/** What to do with the military fields that come from 1C (ЗУП keeps «Військовий облік» too). */
export type HrMilitaryPolicy = 'FILL_EMPTY' | 'OVERWRITE' | 'IGNORE';

export type HrBatchStatus = 'PENDING' | 'APPLIED' | 'PARTIAL' | 'FAILED' | 'DISCARDED';
export type HrBatchSource = 'PUSH' | 'ODATA_MANUAL' | 'ODATA_SCHEDULE';
export type HrItemAction =
  'CREATE' | 'UPDATE' | 'DISMISS' | 'UNCHANGED' | 'SKIP' | 'ERROR' | 'CONFLICT';

/** What the settings page shows (the OData password and the push key are never sent back). */
export interface HrSyncSettingsView {
  configured: boolean;
  system: HrSystem;
  mode: HrSyncMode;
  frequency: HrSyncFrequency;
  /** ONCE: when the data of 1C were applied — nothing more is taken (until «Отримати ще раз»). */
  completedAt: string | null;
  /** ONCE + PUSH: until when 1C may still send the rest of its parts. */
  pushWindowUntil: string | null;
  odataUrl: string;
  odataUser: string;
  hasOdataPassword: boolean;
  /** ЄДРПОУ of the organization in 1C whose employees are taken (defaults to the legal entity's code). */
  organizationCode: string;
  scheduleEnabled: boolean;
  /** Hour (Kyiv time) of the daily OData read. */
  scheduleHour: number;
  /** Apply a received batch at once; otherwise it waits for a review. */
  autoApply: boolean;
  militaryPolicy: HrMilitaryPolicy;
  /** Add people that are already dismissed in 1C (normally — no: the TCK was notified long ago). */
  importDismissed: boolean;
  /** «mr1c_ab12…» — the visible start of the push key, or '' when none is issued. */
  tokenPrefix: string;
  tokenIssuedAt: string | null;
  /** The key stops working then; null — until it is revoked. */
  tokenExpiresAt: string | null;
  /** The addresses of the 1C server the key is accepted from («a, b/24»); '' — any. */
  pushAllowedIps: string;
  lastRunAt: string | null;
  lastStatus: HrBatchStatus | null;
  lastMessage: string;
  /** Where 1C sends the data (shown with the key). */
  pushUrl: string;
  /** Development only: OData servers inside the local network are allowed. */
  allowPrivateHosts: boolean;
}

/** A field that will change in our card: «Посада: інженер → старший інженер». */
export interface HrFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

/** One person of a batch: what will happen (or happened) to him. */
export interface HrBatchItem {
  key: string;
  action: HrItemAction;
  fullName: string;
  personnelNumber: string;
  employeeId: string | null;
  changes: HrFieldChange[];
  messages: string[];
  /** After applying: done or the reason why not. */
  result?: 'OK' | 'FAILED';
}

export interface HrBatchCounts {
  total: number;
  create: number;
  update: number;
  dismiss: number;
  unchanged: number;
  skip: number;
  error: number;
  conflict: number;
}

export interface HrBatchSummary {
  id: string;
  source: HrBatchSource;
  status: HrBatchStatus;
  system: HrSystem;
  receivedAt: string;
  appliedAt: string | null;
  appliedBy: string;
  counts: HrBatchCounts;
  message: string;
}

export interface HrBatchView extends HrBatchSummary {
  items: HrBatchItem[];
}

/** «Перевірити з'єднання» with an OData publication. */
export interface HrODataCheck {
  ok: boolean;
  message: string;
  /** The configuration recognised by the tables found: «ЗУП (російські назви)» … */
  detected: string;
  organizations: { code: string; name: string }[];
  employees: number;
  missing: string[];
}

/** The settings form (the password: empty — keep the saved one). */
export interface HrSyncForm {
  system: HrSystem;
  mode: HrSyncMode;
  frequency: HrSyncFrequency;
  odataUrl: string;
  odataUser: string;
  odataPassword: string;
  organizationCode: string;
  scheduleEnabled: boolean;
  scheduleHour: number;
  autoApply: boolean;
  militaryPolicy: HrMilitaryPolicy;
  importDismissed: boolean;
  pushAllowedIps: string;
}

/** A new push key — shown once. */
export interface HrTokenIssued {
  token: string;
  settings: HrSyncSettingsView;
}

/** The page «Інтеграція з 1С»: the legal entity, its settings and the latest deliveries. */
export interface HrSyncPageData {
  entityId: string;
  entityName: string;
  edrpou: string;
  settings: HrSyncSettingsView;
  history: HrBatchSummary[];
}
