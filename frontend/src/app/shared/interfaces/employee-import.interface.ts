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
}
