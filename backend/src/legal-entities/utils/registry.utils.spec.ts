import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../../military/employee-rules.js';
import {
  isTerminated,
  pickRegistryCompany,
  postalCodeFromAddress,
  signatureName,
  toRegistryCompany,
} from './registry.utils.js';

// all names and codes below are fictitious
describe('registry utils', () => {
  it('finds the company in different answer shapes', () => {
    const company = { name: 'ТОВ «ПРИКЛАД»', egrpou: '12345678' };
    expect(pickRegistryCompany(company)).toBe(company);
    expect(pickRegistryCompany({ data: company })).toBe(company);
    expect(pickRegistryCompany([company])).toBe(company);
    expect(pickRegistryCompany({ result: { item: company } })).toBe(company);
    expect(pickRegistryCompany({ error: 'not found' })).toBeNull();
    expect(pickRegistryCompany(null)).toBeNull();
  });

  it('turns the head name into the signature form', () => {
    expect(signatureName('ПРИКЛАДНИЙ ІВАН ІВАНОВИЧ')).toBe('Іван ПРИКЛАДНИЙ');
    expect(signatureName('зразкова анна-марія петрівна')).toBe('Анна-Марія ЗРАЗКОВА');
    expect(signatureName('Директор')).toBe('Директор');
  });

  it('takes the postal code from the address', () => {
    expect(postalCodeFromAddress('79000, Львівська обл., м. Львів, вул. Зразкова, 1')).toBe('79000');
    expect(postalCodeFromAddress('м. Київ, вул. Зразкова, 123456')).toBe('');
  });

  it('maps the raw record to the form fields', () => {
    const c = toRegistryCompany(
      {
        name: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ «ПРИКЛАД»',
        name_short: 'ТОВ «ПРИКЛАД»',
        address: '79000, м. Львів, вул. Зразкова, 1',
        director: 'ПРИКЛАДНИЙ ІВАН ІВАНОВИЧ',
        kved: 'Розроблення програмного забезпечення',
        kved_number: '62.01',
      },
      '12345678',
      'ЄДР',
    );
    expect(c).toMatchObject({
      edrpou: '12345678',
      shortName: 'ТОВ «ПРИКЛАД»',
      postalCode: '79000',
      headName: 'Іван ПРИКЛАДНИЙ',
      headFullName: 'ПРИКЛАДНИЙ ІВАН ІВАНОВИЧ',
      terminated: false,
      kved: '62.01 Розроблення програмного забезпечення',
    });
  });

  it('позначає припинені компанії', () => {
    expect(isTerminated({ name: 'X', status: 'зареєстровано' })).toBe(false);
    expect(isTerminated({ name: 'X', status: 'припинено' })).toBe(true);
    expect(isTerminated({ name: 'X', stan: 'в стані припинення' })).toBe(true);
    expect(isTerminated({ name: 'X' })).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('keeps only the country code and the digits', () => {
    expect(normalizePhone('+380 67 000 00 00')).toBe('+380670000000');
    expect(normalizePhone('067 000 00 00')).toBe('+380670000000');
    expect(normalizePhone('(032) 000-00-00')).toBe('+380320000000');
    expect(normalizePhone('380670000000')).toBe('+380670000000');
    expect(normalizePhone('+48 600 000 000')).toBe('+48600000000');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('немає')).toBe('немає');
  });
});
