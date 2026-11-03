import { AUDIT_SENSITIVE_FIELDS } from '../audit.constants.js';

/** «1234567890» → «•••90». */
export function mask(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return value;
  const s = String(value);
  return s.length <= 2 ? '•••' : `•••${s.slice(-2)}`;
}

/** Diff with sensitive values masked — what goes to the audit log. */
export function maskDiff(diff: Record<string, [unknown, unknown]>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [k, [a, b]] of Object.entries(diff)) out[k] = AUDIT_SENSITIVE_FIELDS.has(k) ? [mask(a), mask(b)] : [a, b];
  return out;
}
