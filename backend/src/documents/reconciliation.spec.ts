import { describe, expect, it } from 'vitest';
import { evodItem, peopleCount, reconciliationAttachments, reconciliationItem } from './builders.js';

describe('reconciliation package', () => {
  it('counts people in Ukrainian', () => {
    expect([1, 2, 5, 11, 21, 22, 112].map(peopleCount)).toEqual([
      '1 особа',
      '2 особи',
      '5 осіб',
      '11 осіб',
      '21 особа',
      '22 особи',
      '112 осіб',
    ]);
  });

  it('names an extract or a whole list', () => {
    expect(reconciliationItem('CONSCRIPTS', true)).toBe(
      'Виписка зі списку персонального військового обліку призовників',
    );
    expect(reconciliationItem('WOMEN', false)).toMatch(/^Список персонального військового обліку .*жінок$/);
  });

  it('attachments: the extract in 2 copies, the eВОД of every person in 1', () => {
    const people = [
      {
        lastName: 'Іваненко',
        firstName: 'Іван',
        middleName: 'Іванович',
        birthDate: '1990-01-01',
        evod: { number: '1', generatedDate: '2026-03-12', generatedTime: '14:30' },
      },
      { lastName: 'Петренко', firstName: 'Петро', middleName: '', birthDate: null, evod: null },
    ];
    const list = reconciliationAttachments({ extract: true, sections: [{ section: 'SOLDIERS', people: 2 }], people });
    expect(list.map((a) => a.copies)).toEqual([2, 1, 1]);
    expect(list[0].name).toMatch(/^Виписка .* \(2 особи\)$/);
    expect(evodItem(people[0])).toBe(
      'Військово-обліковий документ в електронній формі ІВАНЕНКО Іван Іванович, сформований 12.03.2026 о 14:30',
    );
    expect(evodItem(people[1])).toBe('Військово-обліковий документ в електронній формі ПЕТРЕНКО Петро');
  });
});
