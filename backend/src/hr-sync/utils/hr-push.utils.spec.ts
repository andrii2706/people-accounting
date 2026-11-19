import { describe, expect, it } from 'vitest';
import { HR_MAX_RECORDS_PER_PUSH } from '../hr-sync.constants.js';
import { issueToken, parseToken, PushFormatError, readPushBody, tokenMatches } from './hr-push.utils.js';

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
