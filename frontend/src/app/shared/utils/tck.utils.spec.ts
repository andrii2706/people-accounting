import { describe, expect, it } from 'vitest';
import { EMPTY_TCK_FILTER, NO_TCK_DISTRICT } from '../constants/tck.constants';
import type { Tck } from '../interfaces/dictionary.interface';
import {
  parseTckImport,
  tckMatches,
  tckOption,
  tckPlaceDetails,
  tckPlaceOptions,
  tckPlaceText,
  tckToForm,
} from './tck.utils';

const tck = (name: string, region: string, city: string, district = ''): Tck => ({
  id: name,
  name,
  nameGenitive: '',
  address: `${city}, вул. Тестова, 1`,
  postalCode: '',
  phone: '',
  email: '',
  region,
  district,
  city,
  isActive: true,
});

const LIST = [
  tck('Львівський ОТЦК та СП (м. Львів)', 'Львівська область', 'м. Львів'),
  tck(
    'Шевченківський РТЦК та СП (м. Львів)',
    'Львівська область',
    'м. Львів',
    'Шевченківський район',
  ),
  tck(
    'І відділ Золочівського РТЦК та СП (м. Броди)',
    'Львівська область',
    'м. Броди',
    'Золочівський район',
  ),
  tck('Шевченківський РТЦК та СП (м. Київ)', 'м. Київ', 'м. Київ', 'Шевченківський район'),
];
const names = (f: Partial<typeof EMPTY_TCK_FILTER>) =>
  LIST.filter((t) => tckMatches(t, { ...EMPTY_TCK_FILTER, ...f })).map((t) => t.name);

describe('TCK filters', () => {
  it('by region, town and district', () => {
    expect(names({ region: 'Львівська область' })).toHaveLength(3);
    expect(names({ city: 'м. Броди' })).toEqual(['І відділ Золочівського РТЦК та СП (м. Броди)']);
    expect(names({ district: 'Шевченківський район' })).toHaveLength(2);
    expect(names({ region: 'м. Київ', district: 'Шевченківський район' })).toEqual([
      'Шевченківський РТЦК та СП (м. Київ)',
    ]);
    expect(names({ district: NO_TCK_DISTRICT })).toEqual(['Львівський ОТЦК та СП (м. Львів)']);
  });

  it('the text search also looks at the place', () => {
    expect(names({ query: 'броди' })).toHaveLength(1);
    expect(names({ query: 'золочів' })).toHaveLength(1);
  });

  it('options with counts; the regional and city centres first among districts', () => {
    expect(tckPlaceOptions(LIST, 'region').map((o) => `${o.label} ${o.hint}`)).toEqual([
      'Львівська область 3 ТЦК',
      'м. Київ 1 ТЦК',
    ]);
    expect(tckPlaceOptions(LIST, 'city').map((o) => o.value)).toEqual([
      'м. Броди',
      'м. Київ',
      'м. Львів',
    ]);
    expect(tckPlaceOptions(LIST, 'district')[0]).toMatchObject({
      value: NO_TCK_DISTRICT,
      hint: '1 ТЦК',
    });
  });

  it('a picker option is found by its place', () => {
    expect(tckOption(LIST[2]).hint).toBe('м. Броди · Золочівський район · Львівська область');
    expect(tckPlaceDetails(LIST[3])).toBe('Шевченківський район');
  });
});

describe('форма і імпорт ТЦК', () => {
  it('tckToForm: порожня форма для нового; поля наявного', () => {
    expect(tckToForm(null).name).toBe('');
    const t = tck('Тестовий ТЦК', 'Львівська область', 'м. Броди', 'Золочівський район');
    expect(tckToForm({ ...t, postalCode: null as never, region: null as never })).toMatchObject({
      name: 'Тестовий ТЦК',
      postalCode: '',
      region: '',
    });
    expect(tckPlaceText({ region: 'м. Київ', city: 'м. Київ', district: '' })).toBe('м. Київ');
  });

  it('parseTckImport: масив або {items}; порожні імена відкинуто; помилки читабельні', () => {
    expect(
      parseTckImport(
        JSON.stringify([{ name: ' Тестовий ТЦК ', phone: ' 044 ', email: '' }, { name: '' }]),
      ),
    ).toEqual([{ name: 'Тестовий ТЦК', phone: '044' }]);
    expect(parseTckImport(JSON.stringify({ items: [{ name: 'A', city: 'м. Б' }] }))).toEqual([
      { name: 'A', city: 'м. Б' },
    ]);
    expect(() => parseTckImport('{}')).toThrow('items');
    expect(() => parseTckImport('[]')).toThrow('жодного');
    expect(() =>
      parseTckImport(JSON.stringify(Array.from({ length: 2001 }, (_, i) => ({ name: `Т${i}` })))),
    ).toThrow('Не більше');
  });

  it('tckMatches: район «без району» і текстовий пошук', () => {
    const t = tck('Тестовий ТЦК', 'Львівська область', 'м. Броди');
    expect(tckMatches(t, { ...EMPTY_TCK_FILTER, district: NO_TCK_DISTRICT })).toBe(true);
    expect(tckMatches(t, { ...EMPTY_TCK_FILTER, city: 'м. Інше' })).toBe(false);
    expect(tckMatches(t, { ...EMPTY_TCK_FILTER, query: 'броди' })).toBe(true);
    expect(tckMatches(t, { ...EMPTY_TCK_FILTER, query: 'харків' })).toBe(false);
  });
});
