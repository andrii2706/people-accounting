/**
 * Human names of request fields for error messages («Телефон: …» instead of «phone: …»).
 * Labels depend on the request: `fullName` is «Повна назва» of a company but «ПІБ» of a user.
 */
import { FIELD_LABELS as EMPLOYEE_LABELS } from '../../employees/employees.constants.js';
import { LABELS_BY_REQUEST, LIST_ITEM_LABELS } from '../constants/field-labels.constants.js';

/** «Телефон», «Військово-обліковий документ 1 — Номер»; the key itself when nothing is known. */
export function fieldLabel(field: string, request?: string): string {
  const [head, index, child] = field.split('.');
  const list = LIST_ITEM_LABELS[head];
  if (list && index !== undefined) {
    const n = /^\d+$/.test(index) ? ` ${Number(index) + 1}` : '';
    const sub = child ?? (n ? undefined : index);
    return sub ? `${list.title}${n} — ${list.fields[sub] ?? sub}` : `${list.title}${n}`;
  }
  return (request && LABELS_BY_REQUEST[request]?.[field]) ?? EMPLOYEE_LABELS[field] ?? `Службове поле «${field}»`;
}
