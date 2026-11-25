import type { EmployeeDetails, PendingChange } from '../interfaces/employee.interface';
import type { NoticeDraftInfo } from '../interfaces/employee-dialogs.interface';
import type {
  CombinedLetterGroup,
  CombinedNotice,
  PendingChangesGroup,
} from '../interfaces/letter.interface';

/** «Другий Тест Тестович» → «Другий Т. Т.» */
export function shortFullName(fullName: string): string {
  const [last, ...rest] = fullName.trim().split(/\s+/);
  return [last, rest.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')]
    .filter(Boolean)
    .join(' ');
}

/**
 * The notices of one person, as the server makes them (letters.utils noticeBatches): every hiring separately,
 * all the other changes in one «зміна облікових даних», every dismissal separately.
 */
export function personNotices(
  fullName: string,
  changes: readonly PendingChange[],
): CombinedNotice[] {
  const who = shortFullName(fullName);
  const hires = changes.filter((c) => c.type === 'HIRE');
  const data = changes.filter((c) => c.type !== 'HIRE' && c.type !== 'DISMISSAL');
  const dismissals = changes.filter((c) => c.type === 'DISMISSAL');
  return [
    ...hires.map((): CombinedNotice => ({
      kind: 'HIRE',
      title: 'Повідомлення про прийняття на роботу',
      who,
    })),
    ...(data.length
      ? [{ kind: 'DATA', title: 'Повідомлення про зміну облікових даних', who } as CombinedNotice]
      : []),
    ...dismissals.map((): CombinedNotice => ({
      kind: 'DISMISSAL',
      title: 'Повідомлення про звільнення',
      who,
    })),
  ];
}

/** Pending changes by employee (alphabetically). */
export function byEmployee(pending: readonly PendingChange[]): PendingChangesGroup[] {
  const map = new Map<string, PendingChangesGroup>();
  for (const c of pending) {
    const g = map.get(c.employee.id) ?? {
      employeeId: c.employee.id,
      fullName: c.employee.fullName,
      tckId: c.employee.tckId,
      tckName: c.employee.tckName,
      overdue: false,
      changes: [],
    };
    g.changes.push(c);
    g.overdue ||= c.overdue;
    map.set(c.employee.id, g);
  }
  return [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'uk'));
}

/**
 * The combined letters: pending changes grouped by the legal entity (the sender) and the TCK, as the server
 * forms them. `excluded` — changes taken off by hand: they wait for the next letter. Without a TCK — last.
 */
export function combinedLetters(
  pending: readonly PendingChange[],
  excluded: ReadonlySet<string> = new Set(),
): CombinedLetterGroup[] {
  const map = new Map<string, PendingChange[]>();
  for (const c of pending) {
    const key = `${c.employee.legalEntityId ?? 'none'}|${c.employee.tckId ?? 'none'}`;
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  const groups = [...map.entries()].map(([key, changes]): CombinedLetterGroup => {
    const first = changes[0].employee;
    const employees = byEmployee(changes);
    const included = changes.filter((c) => !excluded.has(c.id));
    const deadlines = included.map((c) => c.deadline).sort();
    return {
      key,
      tckId: first.tckId,
      tckName: first.tckName,
      tckNameGenitive: first.tckNameGenitive || first.tckName,
      legalEntityId: first.legalEntityId,
      legalEntityName: first.legalEntityName,
      employees,
      included,
      notices: employees.flatMap((e) =>
        personNotices(
          e.fullName,
          e.changes.filter((c) => !excluded.has(c.id)),
        ),
      ),
      earliestDeadline: deadlines[0] ?? null,
      overdue: included.some((c) => c.overdue),
    };
  });
  return groups.sort(
    (a, b) =>
      Number(!a.tckId) - Number(!b.tckId) ||
      Number(b.overdue) - Number(a.overdue) ||
      a.tckName.localeCompare(b.tckName, 'uk'),
  );
}

/** The combined letter the employee's new notice goes into: its TCK and how much is in it already. */
export function noticeDraftInfo(
  pending: readonly PendingChange[],
  e: Pick<EmployeeDetails, 'tckId' | 'legalEntityId' | 'tck'>,
): NoticeDraftInfo | null {
  if (!e.tckId) return null;
  const same = pending.filter(
    (c) =>
      c.employee.tckId === e.tckId &&
      (c.employee.legalEntityId ?? null) === (e.legalEntityId ?? null),
  );
  return {
    tckName: e.tck?.nameGenitive || e.tck?.name || same[0]?.employee.tckName || 'ТЦК',
    notices: same.length,
    employees: new Set(same.map((c) => c.employee.id)).size,
  };
}
