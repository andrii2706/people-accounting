import type {
  CheckedImportRow,
  ImportRow,
  ImportRowStatus,
} from '../interfaces/employee-import.interface';
/** A row without client-only fields — what the API accepts. */
export const toPlainImportRow = ({ rowNumber, values, issues }: ImportRow): ImportRow => ({
  rowNumber,
  values,
  issues,
});

/** Status of a checked row in the preview. */
export const importRowStatus = (r: CheckedImportRow): ImportRowStatus =>
  r.errors.length ? 'error' : r.duplicate ? 'duplicate' : 'ready';
