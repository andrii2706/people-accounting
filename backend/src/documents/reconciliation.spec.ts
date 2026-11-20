import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  changeNoticeInventoryItems,
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
    expect(reconciliationItem('CONSCRIPTS', true)).toBe('Витяг зі списку персонального військового обліку призовників');
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
    expect(list[0].name).toMatch(/^Витяг .* \(2 особи\)$/);
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
    // two identical copies side by side
    expect(count('ОПИС ВКЛАДЕННЯ')).toBe(2);
    expect(count('цінному листі')).toBe(2);
    expect(count('Загальний підсумок кількості предметів та оголошеної цінності')).toBe(2);
    for (const label of ['Найменування предметів', 'Кількість предметів', 'Оголошена цінність, грн', 'Перевірив']) {
      expect(text).toContain(label);
    }
    // «Куди» — as on the envelope: the street, the settlement, the index
    expect(text).toContain('вул. Батуринська, 2, м. Львів, 79007');
    expect(text).toContain('на 1 арк.'); // the eВОД: 1 sheet
    expect(text).toContain('на ____ арк.'); // the extract: the sheets by hand
    expect(text).toContain('ТОВ «Вигадана компанія»'); // the sender
    expect(text).toContain('Виправлення не допускаються');
  });

  it('the cover letter is the letter alone — the inventory for the post is a file of its own', async () => {
    const input = {
      part: 'cover',
      org: {
        shortName: 'ТОВ «Вигадана компанія»',
        fullName: '',
        address: '',
        edrpou: '12345678',
        headName: '',
        headPosition: '',
      },
      tck: { name: 'Шевченківський РТЦК та СП (м. Львів)', address: '79007, м. Львів, вул. Батуринська, 2' },
      letter: { number: '7', date: '2026-11-20' },
      reportDate: '2026-11-20',
      extract: true,
      sections: [{ section: 'SOLDIERS', people: 1 }],
      people: [{ lastName: 'Прикладний', firstName: 'Сергій', middleName: '', birthDate: '1979-11-03', evod: null }],
      responsible: null,
    } as unknown as Parameters<typeof buildReconciliation>[0];
    const zip = await JSZip.loadAsync(await buildReconciliation(input));
    const text = (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');
    expect(text).toContain('Щодо звірки облікових даних');
    expect(text).not.toContain('ОПИС');
  });

  it('form 107 of a letter with notices: the letter and every notice on a line of its own', () => {
    const person = { lastName: 'Прикладний', firstName: 'Сергій', middleName: '', birthDate: '1979-11-03' };
    const items = changeNoticeInventoryItems({ number: '12', date: '2026-11-20' }, [
      { ...person, sequence: 1, changeType: 'HIRE' },
      { ...person, sequence: 2, changeType: 'POSITION' },
    ] as Parameters<typeof changeNoticeInventoryItems>[1]);
    expect(items).toHaveLength(3);
    expect(items[0].name).toMatch(/^Лист щодо повідомлення про зміну облікових даних працівника/);
    expect(items[1].name).toMatch(/№ 12\/1/);
    expect(items.every((i) => i.copies === 1 && i.sheets === '1')).toBe(true);
  });
});
