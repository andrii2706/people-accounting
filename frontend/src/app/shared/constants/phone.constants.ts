import type { PhoneCountry } from '../interfaces/phone.interface';

/** Ukraine by default: most employees, companies and TCKs have Ukrainian numbers. */
export const DEFAULT_PHONE_CODE = '380';

/** Countries in the phone field (Ukraine and the countries where employees most often are). */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: '380', iso: 'UA', name: 'Україна', example: '671234567' },
  { code: '48', iso: 'PL', name: 'Польща', example: '512345678' },
  { code: '49', iso: 'DE', name: 'Німеччина', example: '15123456789' },
  { code: '420', iso: 'CZ', name: 'Чехія', example: '601123456' },
  { code: '421', iso: 'SK', name: 'Словаччина', example: '912123456' },
  { code: '36', iso: 'HU', name: 'Угорщина', example: '201234567' },
  { code: '40', iso: 'RO', name: 'Румунія', example: '712345678' },
  { code: '373', iso: 'MD', name: 'Молдова', example: '62112345' },
  { code: '370', iso: 'LT', name: 'Литва', example: '61234567' },
  { code: '371', iso: 'LV', name: 'Латвія', example: '21234567' },
  { code: '372', iso: 'EE', name: 'Естонія', example: '51234567' },
  { code: '43', iso: 'AT', name: 'Австрія', example: '6641234567' },
  { code: '39', iso: 'IT', name: 'Італія', example: '3123456789' },
  { code: '34', iso: 'ES', name: 'Іспанія', example: '612345678' },
  { code: '33', iso: 'FR', name: 'Франція', example: '612345678' },
  { code: '31', iso: 'NL', name: 'Нідерланди', example: '612345678' },
  { code: '44', iso: 'GB', name: 'Велика Британія', example: '7400123456' },
  { code: '353', iso: 'IE', name: 'Ірландія', example: '850123456' },
  { code: '995', iso: 'GE', name: 'Грузія', example: '555123456' },
  { code: '90', iso: 'TR', name: 'Туреччина', example: '5012345678' },
  { code: '972', iso: 'IL', name: 'Ізраїль', example: '502345678' },
  { code: '1', iso: 'US', name: 'США / Канада', example: '2015550123' },
];
