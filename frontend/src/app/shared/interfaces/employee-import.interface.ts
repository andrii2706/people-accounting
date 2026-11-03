/** Values of one imported row — the same fields as the employee form payload. */
export type ImportValues = Record<string, string | number | boolean | null>;

export interface ImportFieldError {
  field: string;
  message: string;
}

export interface ImportRow {
  /** Row number in the file, as the user sees it in Excel. */
  rowNumber: number;
  values: ImportValues;
  /** Problems found while reading the file; kept until the user edits the field. */
  issues: ImportFieldError[];
}

export interface CheckedImportRow extends ImportRow {
  fullName: string;
  errors: ImportFieldError[];
  duplicate: { id: string; fullName: string; by: 'rnokpp' | 'name' } | null;
}

export interface ImportColumnMapping {
  header: string;
  field: string | null;
  label: string | null;
}

export interface ImportPreview {
  fileName?: string;
  mapping: ImportColumnMapping[];
  rows: CheckedImportRow[];
}

export interface ImportResult {
  created: number;
  ids: string[];
  /** TCK notices about hiring / dismissal queued by the import. */
  notices: number;
}

/** Which hiring / dismissal notices the import queues: recent ones (default), all, none. */
export type HireNoticesMode = 'RECENT' | 'ALL' | 'NONE';

export type ImportFieldKind =
  'text' | 'date' | 'gender' | 'rank' | 'tck' | 'passportType' | 'bool' | 'docType';

export type ImportRowStatus = 'ready' | 'error' | 'duplicate';

export type ImportRowFilter = 'all' | ImportRowStatus;

/** A field editable in the import preview. */
export interface ImportEditField {
  key: string;
  label: string;
  kind: ImportFieldKind;
}

/** Body of a 400 from the import commit: rows re-checked by the server. */
export interface ImportCommitErrorBody {
  rows?: CheckedImportRow[];
}
