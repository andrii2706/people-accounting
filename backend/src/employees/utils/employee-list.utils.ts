import type { RecordWarning, WithWarningSummary } from '../../shared/interfaces/employee.interface.js';

/**
 * The employee list carries only the code and level of each warning (not info): the texts are long and repeat
 * for hundreds of people, the card shows them in full. A thousand employees stay well under 1 MB.
 */
export function summarizeWarnings<T extends { warnings: RecordWarning[] }>(d: T): WithWarningSummary<T> {
  return {
    ...d,
    warnings: d.warnings.filter((w) => w.level !== 'info').map(({ code, level }) => ({ code, level })),
  };
}
