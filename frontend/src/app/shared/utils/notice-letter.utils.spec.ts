import { describe, expect, it } from 'vitest';
import type { PendingChange } from '../interfaces/employee.interface';
import {
  combinedLetters,
  noticeDraftInfo,
  personNotices,
  shortFullName,
} from './notice-letter.utils';

/** A pending change of a fictional employee. */
function change(
  id: string,
  type: PendingChange['type'],
  who: { id: string; name: string; tck: string | null; entity?: string },
  overdue = false,
): PendingChange {
  return {
    id,
    type,
    typeLabel: type,
    oldValue: '',
    newValue: '',
    effectiveDate: '2026-11-18',
    basis: '',
    skipped: false,
    deadline: overdue ? '2026-11-08' : '2026-11-25',
    overdue,
    letter: null,
    createdAt: '2026-11-18T10:00:00Z',
    employee: {
      id: who.id,
      fullName: who.name,
      tckId: who.tck,
      tckName: who.tck ? `ТЦК ${who.tck}` : '',
      tckNameGenitive: who.tck ? `ТЦК-р ${who.tck}` : '',
      tckEmail: '',
      legalEntityId: who.entity ?? 'le1',
      legalEntityName: 'Вигадана компанія',
    },
  };
}

const testovyi = { id: 'e1', name: 'Тестовий Олег Петрович', tck: 'A' };
const druhyi = { id: 'e2', name: 'Другий Тест Тестович', tck: 'A' };
const zrazkova = { id: 'e3', name: 'Зразкова Марія Іванівна', tck: 'B' };
const noTck = { id: 'e4', name: 'Разовий Тест Тестович', tck: null };

describe('notice letters', () => {
  it('short names', () => {
    expect(shortFullName('Другий Тест Тестович')).toBe('Другий Т. Т.');
    expect(shortFullName('Прикладний')).toBe('Прикладний');
  });

  it('one person: hiring, one combined data change, dismissal', () => {
    const changes = [
      change('1', 'PASSPORT', druhyi),
      change('2', 'HIRE', druhyi),
      change('3', 'ACTUAL_ADDRESS', druhyi),
    ];
    expect(personNotices('Другий Тест Тестович', changes).map((n) => n.kind)).toEqual([
      'HIRE',
      'DATA',
    ]);
  });

  it('one letter per legal entity and TCK; without a TCK — last; taken off changes stay out', () => {
    const pending = [
      change('1', 'PASSPORT', testovyi),
      change('2', 'HIRE', druhyi, true),
      change('3', 'DISMISSAL', zrazkova),
      change('4', 'PASSPORT', noTck),
      change('5', 'PASSPORT', { ...druhyi, entity: 'le2' }),
    ];
    const letters = combinedLetters(pending, new Set(['1']));
    expect(letters.map((l) => l.key)).toEqual(['le1|A', 'le2|A', 'le1|B', 'le1|none']);
    const a = letters[0];
    expect(a.employees.map((e) => e.fullName)).toEqual([
      'Другий Тест Тестович',
      'Тестовий Олег Петрович',
    ]);
    expect(a.included.map((c) => c.id)).toEqual(['2']);
    expect(a.notices).toEqual([
      { kind: 'HIRE', title: 'Повідомлення про прийняття на роботу', who: 'Другий Т. Т.' },
    ]);
    expect(a.overdue).toBe(true);
    expect(a.earliestDeadline).toBe('2026-11-08');
    expect(a.tckNameGenitive).toBe('ТЦК-р A');
  });

  it('where a new notice of the employee goes', () => {
    const pending = [
      change('1', 'PASSPORT', testovyi),
      change('2', 'HIRE', druhyi),
      change('3', 'HIRE', zrazkova),
    ];
    expect(
      noticeDraftInfo(pending, {
        tckId: 'A',
        legalEntityId: 'le1',
        tck: { nameGenitive: 'Шевченківського РТЦК та СП' } as never,
      }),
    ).toEqual({ tckName: 'Шевченківського РТЦК та СП', notices: 2, employees: 2 });
    expect(noticeDraftInfo(pending, { tckId: null, legalEntityId: 'le1', tck: null })).toBeNull();
  });
});
