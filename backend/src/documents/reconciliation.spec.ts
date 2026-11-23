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
import { DEFAULT_LETTERHEAD_SETTINGS } from './letterhead.constants.js';

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

  it('the cover letter on the letterhead of the company: its requisites at the top, the number beside the TCK', async () => {
    const input = {
      part: 'cover',
      org: {
        fullName: 'Товариство з обмеженою відповідальністю «Вигадана компанія»',
        shortName: 'ТОВ «Вигадана компанія»',
        address: 'м. Львів, вул. Зразкова, 10',
        postalCode: '79000',
        edrpou: '12345678',
        phone: '(032) 111-22-33',
        email: '',
        headName: '',
        headPosition: '',
      },
      letterhead: DEFAULT_LETTERHEAD_SETTINGS,
      tck: { name: 'Шевченківський РТЦК та СП (м. Львів)', address: '79007, м. Львів, вул. Батуринська, 2' },
      letter: { number: '7', date: '2026-11-20' },
      reportDate: '2026-11-20',
      extract: true,
      sections: [{ section: 'SOLDIERS', people: 1 }],
      people: [{ lastName: 'Прикладний', firstName: 'Сергій', middleName: '', birthDate: '1979-11-03', evod: null }],
      responsible: null,
    } as unknown as Parameters<typeof buildReconciliation>[0];
    const zip = await JSZip.loadAsync(await buildReconciliation(input));
    const xml = await zip.file('word/document.xml')!.async('string');
    const text = xml.replace(/<[^>]+>/g, '');
    const at = (s: string) => text.indexOf(s);
    expect(at('Товариство з обмеженою відповідальністю «Вигадана компанія»')).toBe(0);
    expect(text).toContain('79000, м. Львів, вул. Зразкова, 10');
    expect(text).toContain('Код ЄДР 12345678');
    expect(text).toContain('Тел. (032) 111-22-33');
    expect(at('Вих. № 7')).toBeGreaterThan(at('Код ЄДР'));
    expect(xml).toContain('Arial');
    // off — the requisites in the corner, as before
    const plain = await JSZip.loadAsync(
      await buildReconciliation({ ...input, letterhead: { ...DEFAULT_LETTERHEAD_SETTINGS, enabled: false } }),
    );
    const before = (await plain.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');
    expect(before).toContain('Код ЄДР - 12345678');
    expect(before.startsWith('ТОВ «Вигадана компанія»')).toBe(true);
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

  it('the sheets of the extract and the declared value are numbers, the total is their sum', async () => {
    const base = {
      org: { shortName: 'ТОВ «Вигадана компанія»', fullName: '', address: '', edrpou: '12345678' },
      tck: { name: 'Шевченківський РТЦК та СП (м. Львів)', address: '79007, м. Львів, вул. Батуринська, 2' },
      letter: { number: '7', date: '2026-11-20' },
      reportDate: '2026-11-20',
      extract: true,
      sections: [{ section: 'SOLDIERS', people: 1, sheets: 3 }],
      people: [
        {
          lastName: 'Прикладний',
          firstName: 'Сергій',
          middleName: '',
          birthDate: '1979-11-03',
          evod: { number: '1', generatedDate: '2026-11-18', generatedTime: '09:45' },
        },
      ],
      responsible: null,
      declaredValue: 20,
    };
    const read = async (part: string) => {
      const input = { ...base, part } as unknown as Parameters<typeof buildReconciliation>[0];
      const zip = await JSZip.loadAsync(await buildReconciliation(input));
      return (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');
    };
    const cover = await read('cover');
    expect(cover).toContain('на 3 арк. в 2 прим.');
    expect(cover).not.toContain('___ арк.');
    const post = await read('inventory');
    // the letter itself (1 sheet), the extract (3), the eВОД (1) — every line 20 грн, 60 грн in all
    expect(post).toContain('від 20.11.2026 р. № 7, на 1 арк.');
    expect(post).toContain('на 3 арк.');
    expect(post).not.toContain('____ арк.');
    expect(post.split('20').length).toBeGreaterThan(6);
    expect(post).toContain('60');
  });
});
