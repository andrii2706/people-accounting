import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  buildReconciliation,
  evodItem,
  peopleCount,
  reconciliationAttachments,
  reconciliationItem,
} from './builders.js';

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

  it('form 107 as the Ukrposhta blank, in two copies', async () => {
    const input = {
      part: 'inventory',
      org: { shortName: 'ТОВ «Вигадана компанія»', fullName: '', address: '', edrpou: '12345678' },
      tck: { name: 'Шевченківський РТЦК та СП (м. Львів)', address: '79007, м. Львів, вул. Батуринська, 2' },
      letter: { number: '7', date: '2026-11-20' },
      reportDate: '2026-11-20',
      extract: true,
      sections: [{ section: 'SOLDIERS', people: 1 }],
      people: [
        {
          lastName: 'Прикладний',
          firstName: 'Сергій',
          middleName: 'Іванович',
          birthDate: '1979-11-03',
          evod: { number: '1', generatedDate: '2026-11-18', generatedTime: '09:45' },
        },
      ],
      responsible: null,
    } as unknown as Parameters<typeof buildReconciliation>[0];
    const zip = await JSZip.loadAsync(await buildReconciliation(input));
    const text = (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');
    const count = (s: string) => text.split(s).length - 1;
    expect(count('ОПИС')).toBe(2);
    expect(count('вкладення до цінного листа')).toBe(2);
    expect(count('Загальний підсумок предметів, аркушів і оголошеної цінності')).toBe(2);
    expect(text).toContain('Кількість предметів, аркушів');
    expect(text).toContain('Оголошена цінність, грн');
    expect(text).toContain('1 / 1'); // the eВОД: 1 copy of 1 sheet
    expect(text).toContain('2 / ___'); // the extract: 2 copies, the sheets by hand
    expect(text).toContain('Виправлення не допускаються');
  });
});
