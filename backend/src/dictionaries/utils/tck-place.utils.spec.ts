import { describe, expect, it } from 'vitest';
import { tckPlace, withPlace } from './tck-place.utils.js';

describe('TCK region / district / town', () => {
  it('a city district TCK', () => {
    expect(
      tckPlace({ name: 'Шевченківський РТЦК та СП (м. Львів)', address: '79005, м. Львів, вул. І. Франка, 25' }),
    ).toEqual({ region: 'Львівська область', district: 'Шевченківський район', city: 'м. Львів' });
  });

  it('a department of a district TCK in another town', () => {
    expect(
      tckPlace({ name: '2 відділ Нікопольського РТЦК та СП (м. Марганець)', address: '' }, 'Дніпропетровська область'),
    ).toEqual({
      region: 'Дніпропетровська область',
      district: 'Нікопольський район',
      city: 'м. Марганець',
    });
    expect(tckPlace({ name: 'І відділ Золочівського РТЦК та СП (м. Броди)' }).district).toBe('Золочівський район');
    expect(tckPlace({ name: 'Відділ Криворізького РТЦК та СП (смт Софіївка)' }).district).toBe('Криворізький район');
  });

  it('regional and city centres serve no single district', () => {
    expect(tckPlace({ name: 'Львівський ОТЦК та СП (м. Львів)' }).district).toBe('');
    expect(tckPlace({ name: 'Київський МТЦК та СП (м. Київ)' }).district).toBe('');
    expect(tckPlace({ name: 'Вінницький ОМТЦК та СП (м. Вінниця)' }).district).toBe('');
    expect(tckPlace({ name: 'Галицько-Франківський ОРТЦК та СП (м. Львів)' }).district).toBe(
      'Галицько-Франківський район',
    );
  });

  it('the region from the address, Kyiv, or the regional centre', () => {
    expect(
      tckPlace({ name: 'Х', address: '76000, Івано-Франківська обл., м. Івано-Франківськ, вул. Х, 1' }).region,
    ).toBe('Івано-Франківська область');
    expect(tckPlace({ name: 'Печерський РТЦК та СП (м. Київ)', address: 'м. Київ, вул. Х' }).region).toBe('м. Київ');
    expect(tckPlace({ name: 'Новий ТЦК', address: '58000, м. Чернівці, вул. Х, 1' })).toMatchObject({
      region: 'Чернівецька область',
      city: 'м. Чернівці',
    });
    expect(tckPlace({ name: 'Х', address: 'Черкаська обл., селище Лисянка, вул. Х' }).city).toBe('селище Лисянка');
  });

  it('keeps what was typed by hand', () => {
    expect(
      withPlace({ name: 'Шевченківський РТЦК та СП (м. Львів)', region: 'Моя область', district: '', city: '' }),
    ).toMatchObject({
      region: 'Моя область',
      district: 'Шевченківський район',
      city: 'м. Львів',
    });
  });
});
