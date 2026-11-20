import { describe, expect, it } from 'vitest';
import { HR_MAX_RECORDS_PER_PUSH } from '../hr-sync.constants.js';
import {
  ipAllowed,
  issueToken,
  parseAllowedIps,
  parseToken,
  PushFormatError,
  readPushBody,
  tokenMatches,
} from './hr-push.utils.js';

describe('1C push key', () => {
  it('is issued, parsed from the header and matched by its hash', () => {
    const { token, prefix, hash } = issueToken();
    expect(token).toMatch(/^mr1c_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/);
    const parsed = parseToken(`Bearer ${token}`);
    expect(parsed?.prefix).toBe(prefix);
    expect(tokenMatches(parsed!.secret, hash)).toBe(true);
    expect(tokenMatches(parsed!.secret, issueToken().hash)).toBe(false);
  });

  it('refuses anything else', () => {
    expect(parseToken(undefined)).toBeNull();
    expect(parseToken('Bearer abc')).toBeNull();
    expect(tokenMatches('x', '')).toBe(false);
  });
});

describe('1C push body', () => {
  it('takes the known fields, cuts long values, ignores the rest', () => {
    const [r] = readPushBody({
      employees: [
        {
          lastName: '  Приклад ',
          firstName: 'Петро',
          unknown: 'x',
          personnelNumber: 7,
          military: { registered: true, rank: 'солдат', document: { type: 'військовий квиток', number: 'АА 123456' } },
        },
      ],
    });
    expect(r).toEqual({
      lastName: 'Приклад',
      firstName: 'Петро',
      personnelNumber: '7',
      military: { registered: true, rank: 'солдат', document: { type: 'військовий квиток', number: 'АА 123456' } },
    });
  });

  it('explains a wrong body', () => {
    expect(() => readPushBody({})).toThrow(PushFormatError);
    expect(() => readPushBody({ employees: [] })).toThrow(/порожній/);
    expect(() => readPushBody({ employees: [{ firstName: 'Петро' }] })).toThrow(/прізвища/);
    const many = Array.from({ length: HR_MAX_RECORDS_PER_PUSH + 1 }, () => ({ lastName: 'Приклад' }));
    expect(() => readPushBody({ employees: many })).toThrow(/частинами/);
  });
});

describe('allowed addresses of the key', () => {
  it('parses addresses and networks', () => {
    expect(parseAllowedIps(' 203.0.113.5, 198.51.100.0/24\n2001:db8::/48 203.0.113.5', 20)).toEqual([
      '203.0.113.5',
      '198.51.100.0/24',
      '2001:db8::/48',
    ]);
    expect(parseAllowedIps('', 20)).toEqual([]);
    expect(() => parseAllowedIps('1c.company.ua', 20)).toThrow(/не IP-адреса/);
    expect(() => parseAllowedIps('10.0.0.0/33', 20)).toThrow();
    expect(() => parseAllowedIps('1.1.1.1 2.2.2.2', 1)).toThrow(/Не більше 1/);
  });

  it('checks the address', () => {
    const list = ['203.0.113.5', '198.51.100.0/24', '2001:db8::/48'];
    expect(ipAllowed(list, '203.0.113.5')).toBe(true);
    expect(ipAllowed(list, '::ffff:198.51.100.77')).toBe(true);
    expect(ipAllowed(list, '2001:db8:0:1::5')).toBe(true);
    expect(ipAllowed(list, '203.0.113.6')).toBe(false);
    expect(ipAllowed(list, '')).toBe(false);
    expect(ipAllowed([], '8.8.8.8')).toBe(true);
  });
});
