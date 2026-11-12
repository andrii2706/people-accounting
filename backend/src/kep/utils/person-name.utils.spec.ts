import { describe, expect, it } from 'vitest';
import { certificateFullName, matchesSignatureName, nameTokens, samePerson } from './person-name.utils.js';

describe('nameTokens', () => {
  it('приводить до верхнього регістру, одного апострофа й кирилиці', () => {
    expect(nameTokens('  Мар’яна   Петрів-Коваль ')).toEqual(["МАР'ЯНА", 'ПЕТРІВ-КОВАЛЬ']);
    expect(nameTokens('Мар`яна')).toEqual(["МАР'ЯНА"]);
    // латинські «I» і «O» у прізвищі з сертифіката
    expect(nameTokens('IВАНОВ')).toEqual(['ІВАНОВ']);
  });
});

describe('samePerson', () => {
  it('ЄДР і сертифікат з по батькові', () => {
    expect(samePerson('ПЕТРЕНКО ІВАН ІВАНОВИЧ', 'Петренко Іван Іванович')).toBe(true);
  });
  it('у сертифікаті немає по батькові', () => {
    expect(samePerson('ПЕТРЕНКО ІВАН ІВАНОВИЧ', 'Петренко Іван')).toBe(true);
  });
  it('інше ім’я або по батькові — інша людина', () => {
    expect(samePerson('ПЕТРЕНКО ІВАН ІВАНОВИЧ', 'Петренко Іван Петрович')).toBe(false);
    expect(samePerson('ПЕТРЕНКО ІВАН ІВАНОВИЧ', 'Петренко Ігор Іванович')).toBe(false);
    expect(samePerson('ПЕТРЕНКО ІВАН', 'Петренко')).toBe(false);
  });
  it('апострофи різних видів', () => {
    expect(samePerson("ОБ'ЄДНАНИЙ ЮРІЙ", 'Обʼєднаний Юрій')).toBe(true);
  });
});

describe('certificateFullName', () => {
  it('прізвище + ім’я з по батькові, інакше commonName', () => {
    expect(certificateFullName({ commonName: 'X', surname: 'Петренко', givenName: 'Іван Іванович' })).toBe(
      'Петренко Іван Іванович',
    );
    expect(certificateFullName({ commonName: 'Петренко Іван', surname: '', givenName: '' })).toBe('Петренко Іван');
  });
});

describe('matchesSignatureName', () => {
  it('«Іван ПЕТРЕНКО» з документів відповідає повному імені', () => {
    expect(matchesSignatureName('Петренко Іван Іванович', 'Іван ПЕТРЕНКО')).toBe(true);
    expect(matchesSignatureName('Петренко Іван Іванович', 'Ігор ПЕТРЕНКО')).toBe(false);
  });
});
