import { describe, expect, it } from 'vitest';
import { addressOf, givenNameOf } from './name-declension.js';

describe('звернення в листах і на екрані — кличний відмінок', () => {
  it('ім’я знаходиться за будь-якого порядку', () => {
    expect(givenNameOf('Галина Петренко')).toBe('Галина');
    expect(givenNameOf('Петренко Галина Іванівна')).toBe('Галина');
    expect(givenNameOf('ПЕТРЕНКО Галина')).toBe('Галина');
    expect(givenNameOf('Ковальчук Тарас')).toBe('Тарас');
    expect(givenNameOf('Котляревська Ольга')).toBe('Ольга');
    expect(givenNameOf('Іванова Олена')).toBe('Олена');
    expect(givenNameOf('Марко Петрів')).toBe('Марко');
    expect(givenNameOf('Єва Петренко')).toBe('Єва');
    expect(givenNameOf('ПЕТРЕНКО')).toBe('');
    expect(givenNameOf('Адміністратор')).toBe('');
    expect(givenNameOf('Admin Test')).toBe('');
  });

  it('«п. Галино», «п. Тарасе», «п. Ольго»', async () => {
    expect(await addressOf('Галина Петренко')).toBe('п. Галино');
    expect(await addressOf('Петренко Галина Іванівна')).toBe('п. Галино');
    expect(await addressOf('Ковальчук Тарас')).toBe('п. Тарасе');
    expect(await addressOf('Ольга ОБЛІКОВА')).toBe('п. Ольго');
  });

  it('ім’я не знайдено — звернення без імені, а не в називному відмінку', async () => {
    expect(await addressOf('ПЕТРЕНКО')).toBe('');
    expect(await addressOf('')).toBe('');
  });
});
