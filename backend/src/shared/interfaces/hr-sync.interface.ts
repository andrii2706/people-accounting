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
 * How often: ONCE — a single initial load (after the first applied delivery the integration closes, the cards
 * are kept in the app from then on); ONGOING — daily and by hand.
 */
export type HrSyncFrequency = 'ONCE' | 'ONGOING';

/** What to do with the military fields that come from 1C (ЗУП keeps «Військовий облік» too). */
export type HrMilitaryPolicy = 'FILL_EMPTY' | 'OVERWRITE' | 'IGNORE';

export type HrBatchStatus = 'PENDING' | 'APPLIED' | 'PARTIAL' | 'FAILED' | 'DISCARDED';
export type HrBatchSource = 'PUSH' | 'ODATA_MANUAL' | 'ODATA_SCHEDULE';
export type HrItemAction = 'CREATE' | 'UPDATE' | 'DISMISS' | 'UNCHANGED' | 'SKIP' | 'ERROR' | 'CONFLICT';

/** A military document of a person as 1C knows it. */
export interface HrMilitaryDocument {
  type?: string;
  series?: string;
  number?: string;
  issuedBy?: string;
  issuedAt?: string;
}

/** Military registration data of a person as 1C knows it (ЗУП: «Військовий облік»). */
export interface HrMilitary {
  registered?: boolean | string;
  /** «солдат», «старший лейтенант» … — text, recognised like in the file import */
  rank?: string;
  vos?: string;
  /** «призовник», «військовозобов’язаний», «резервіст» */
  category?: string;
  registryNumber?: string;
  fitness?: string;
  fitnessDate?: string;
  /** the TCK as text — matched to the directory */
  tck?: string;
  servedInArmy?: boolean | string;
  document?: HrMilitaryDocument;
}

/**
 * One employee from 1C — the contract of POST /api/integrations/1c/employees and the result of an OData read.
 * Dates — «2026-03-12» or «12.03.2026»; empty strings mean «unknown» and never erase our data.
 */
export interface HrRecord {
  /** The reference of the employee in 1C (Ref_Key / УникальныйИдентификатор) — the most reliable match. */
  externalId?: string;
  personnelNumber?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  /** «Прізвище Ім'я По батькові» when separate parts are not available */
  fullName?: string;
  rnokpp?: string;
  birthDate?: string;
  /** «M»/«F», «чоловіча»/«жіноча», «Мужской»/«Женский» */
  gender?: string;
  phone?: string;
  email?: string;
  registeredAddress?: string;
  actualAddress?: string;
  passport?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: string;
  position?: string;
  department?: string;
  hireDate?: string;
  hireOrderNumber?: string;
  hireOrderDate?: string;
  dismissalDate?: string;
  dismissalOrderNumber?: string;
  dismissalOrderDate?: string;
  military?: HrMilitary;
}

/** What the settings page shows (the OData password and the push key are never sent back). */
export interface HrSyncSettingsView {
  configured: boolean;
  system: HrSystem;
  mode: HrSyncMode;
  frequency: HrSyncFrequency;
  /** ONCE: when the data of 1C were applied — after that nothing more is taken (until «Отримати ще раз»). */
  completedAt: string | null;
  /** ONCE + PUSH: until when 1C may still send the rest of its parts after the first one. */
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
  /** The key stops working then; null — until revoked. */
  tokenExpiresAt: string | null;
  /** The addresses the key is accepted from, «a, b/24»; '' — any. */
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

/** The tables and fields of one 1C configuration as published over OData (names differ by language). */
export interface ODataProfile {
  id: string;
  title: string;
  system: HrSystem;
  employees: string;
  persons: string;
  organizations: string;
  positions: string;
  departments: string;
  /** current HR data of an employee (ЗУП 3) — or the history register (Бухгалтерія) */
  staff: string;
  names: string;
  fields: Record<string, string[]>;
}

/** What the plan needs besides the records: the settings that decide the actions. */
export interface HrPlanOptions {
  militaryPolicy: HrMilitaryPolicy;
  importDismissed: boolean;
  /** today in Kyiv — the date of a new position */
  today: string;
}

/** A planned item together with what will be sent to the employees service (kept in memory only). */
export interface HrPlannedItem extends HrBatchItem {
  /** CREATE: the values of a new card (CreateEmployeeDto) */
  create?: Record<string, unknown>;
  /** UPDATE / DISMISS: the changed fields (UpdateEmployeeDto; a dismissal — with dismissalDate) */
  update?: Record<string, unknown>;
}

/** The answer to 1C after a push. */
export interface HrPushResult {
  batchId: string;
  received: number;
  status: HrBatchStatus;
  counts: HrBatchCounts;
}
