import type { EmployeeChange } from '../../employees/entities/employee-change.entity.js';

/** "2 працівники", "5 працівників", "21 працівник" — Ukrainian plural forms. */
export function employeesCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'працівник'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'працівники'
        : 'працівників';
  return `${n} ${word}`;
}

/** Splits the pending changes of one person into notices: hiring, combined data changes, dismissal. */
export function noticeBatches(changes: EmployeeChange[]): EmployeeChange[][] {
  const hires = changes.filter((c) => c.type === 'HIRE').map((c) => [c]);
  const data = changes.filter((c) => c.type !== 'HIRE' && c.type !== 'DISMISSAL');
  const dismissals = changes.filter((c) => c.type === 'DISMISSAL').map((c) => [c]);
  return [...hires, ...(data.length ? [data] : []), ...dismissals];
}
