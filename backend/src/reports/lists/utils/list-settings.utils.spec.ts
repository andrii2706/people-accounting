import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_SECTION } from '../lists.constants.js';
import { documentSigners, listSectionProblems, withListDefaults } from './list-settings.utils.js';

describe('withListDefaults', () => {
  it('без збережених — стандартні для всіх чотирьох списків', () => {
    const s = withListDefaults(null);
    expect(Object.keys(s)).toEqual(['OFFICERS', 'SOLDIERS', 'WOMEN', 'CONSCRIPTS']);
    expect(s.WOMEN).toEqual(DEFAULT_LIST_SECTION);
  });

  it('биті значення замінюються стандартними, решта зберігається', () => {
    const s = withListDefaults({
      OFFICERS: {
        columns: ['fullName', 'rank'],
        sort: 'BOGUS' as never,
        title: 'СПИСОК',
        signers: [{ position: ' Кадровик ', name: ' Ольга ОБЛІКОВА ' }],
      },
    });
    expect(s.OFFICERS.columns).toEqual(['number', 'fullName', 'rank']);
    expect(s.OFFICERS.sort).toBe('NAME');
    expect(s.OFFICERS.title).toBe('СПИСОК');
    expect(s.OFFICERS.signers).toEqual([{ position: 'Кадровик', name: 'Ольга ОБЛІКОВА' }]);
  });
});

describe('listSectionProblems', () => {
  it('потрібна хоч одна колонка крім №, підписант з іменем', () => {
    const problems = listSectionProblems({
      ...DEFAULT_LIST_SECTION,
      columns: ['number'],
      signers: [{ position: 'X', name: '' }],
    });
    expect(problems.map((p) => p.field)).toEqual(['columns', 'signers.0.name']);
  });
});

describe('documentSigners', () => {
  it('без своїх підписантів — керівник', () => {
    expect(documentSigners(DEFAULT_LIST_SECTION, 'Директор', 'Іван ПРИКЛАДНИЙ')).toEqual([
      { position: 'Директор', name: 'Іван ПРИКЛАДНИЙ' },
    ]);
  });
});
