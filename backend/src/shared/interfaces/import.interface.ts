import type { FieldError } from './common.interface.js';
export type RawCell = string | number | boolean | Date | null;

export interface RawTable {
  headers: string[];
  /** rowNumber — the row number in the file, as the user sees it in Excel. */
  rows: { rowNumber: number; cells: RawCell[] }[];
}

/**
 * Columns of the employee import file: the canonical header (used in the template),
 * header synonyms seen in 1C and HR spreadsheets, and how a cell value is converted.
 */
export type ColumnKind =
  | 'text'
  | 'upper'
  | 'digits'
  | 'date'
  | 'gender'
  | 'rank'
  | 'tck'
  | 'bool'
  | 'passportType'
  | 'militaryDocType'
  | 'fullName'
  | 'passport';

export interface ImportColumn {
  /** Field of CreateEmployeeDto; for compound columns (ПІБ, паспорт) — a pseudo-field. */
  field: string;
  header: string;
  kind: ColumnKind;
  synonyms?: string[];
  /** Not in the template — only recognized in uploaded files. */
  extraOnly?: boolean;
  /** Template column width (characters). */
  width?: number;
  note?: string;
}

export type ImportValues = Record<string, string | number | boolean | null>;

export interface ImportRow {
  rowNumber: number;
  values: ImportValues;
  /** Problems found while reading the file (e.g. an unknown rank) — kept until the user edits the field. */
  issues: FieldError[];
}

export interface ImportContext {
  tcks: { id: string; name: string }[];
}

export interface ColumnMapping {
  header: string;
  field: string | null;
  label: string | null;
}

export interface CheckedRow extends ImportRow {
  fullName: string;
  /** Read issues + validation errors. A row with errors cannot be imported. */
  errors: FieldError[];
  /** The employee is already in the system (by RNOKPP or full name + date of birth) — skipped. */
  duplicate: { id: string; fullName: string; by: 'rnokpp' | 'name' } | null;
}

export interface ImportPreview {
  fileName?: string;
  mapping: ColumnMapping[];
  rows: CheckedRow[];
}

/** The part of the multer file we use (kept in memory, never written to disk). */
export interface UploadedTable {
  originalname: string;
  buffer: Buffer;
}

/**
 * TCK notices about hiring / dismissal on import: only for the recently hired (default),
 * for everyone, or none (the notices for people hired long ago were sent before).
 */
export type HireNoticesMode = 'RECENT' | 'ALL' | 'NONE';

/** Options of an import commit. */
export interface ImportCommitOptions {
  hireNotices: HireNoticesMode;
  fileName?: string;
}

/** Options of a bulk creation from a file. */
export interface CreateManyOptions {
  hireNotices: HireNoticesMode;
  /** Shown in the history of the card: «імпорт з файлу …». */
  source: string;
}

/** Options of creating one card: whether to queue a TCK notice for a hiring / dismissal date. */
export interface CreateEmployeeOptions {
  wantsNotice?: (date: string | null) => boolean;
  source?: string;
}

/** A rank cell of the import file: rank code and whether the rank is a naval one. */
export interface ParsedRank {
  code: number;
  navy: boolean;
}

/** Header → column mapping of an uploaded table. */
export interface ColumnMappingResult {
  mapping: ColumnMapping[];
  columns: (ImportColumn | undefined)[];
}

/** Rows of an uploaded table converted to employee values. */
export interface ConvertedRows {
  mapping: ColumnMapping[];
  rows: ImportRow[];
}

/** A non-empty row of the uploaded sheet with its number as in Excel. */
export interface RawRow {
  rowNumber: number;
  cells: RawCell[];
}
