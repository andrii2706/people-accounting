import type { FieldHistoryEntry, HistoryField } from '../interfaces/employee.interface';

/** The last change of the field (the history comes newest first). */
export function lastChange(
  history: readonly FieldHistoryEntry[] | undefined,
  field: HistoryField,
): FieldHistoryEntry | null {
  return (history ?? []).find((h) => h.field === field) ?? null;
}

/** «з 12.11.2026» — since when the current value is in force; '' when not known. */
export function sinceText(date: string | null | undefined): string {
  return date ? `з ${date.split('-').reverse().join('.')}` : '';
}

/**
 * The earlier TCKs of the employee: «до 01.03.2024 · Франківський РТЦК та СП (з 05.06.2019)».
 * The history row of a TCK change keeps the old TCK and since when it was in force.
 */
export function previousTcks(history: readonly FieldHistoryEntry[] | undefined): string[] {
  const ua = (d: string) => d.split('-').reverse().join('.');
  return (history ?? [])
    .filter((h) => h.field === 'tck' && h.oldValue)
    .map(
      (h) =>
        `до ${ua(h.effectiveDate)} · ${h.oldValue}${h.oldEffectiveDate ? ` (з ${ua(h.oldEffectiveDate)})` : ''}`,
    );
}

/** The lines of «Історія контактів і адрес»: «12.11.2026 · Телефон: +380… → +380…». */
export function contactHistoryLines(
  history: readonly FieldHistoryEntry[] | undefined,
  labels: Record<string, string>,
): string[] {
  const ua = (d: string) => d.split('-').reverse().join('.');
  return (history ?? [])
    .filter((h) => h.field in labels)
    .map(
      (h) =>
        `${ua(h.effectiveDate)} · ${labels[h.field]}: ${h.oldValue || '—'} → ${h.newValue || '—'}${h.basis ? ` (${h.basis})` : ''}`,
    );
}
