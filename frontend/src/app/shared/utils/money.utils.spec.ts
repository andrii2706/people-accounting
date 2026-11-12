import { describe, expect, it } from 'vitest';
import { money } from './money.utils';

describe('гроші', () => {
  it('розряди пробілами, копійки після коми', () => {
    expect(money(749)).toBe('749,00');
    expect(money(7490)).toBe('7 490,00');
    expect(money(1250.5)).toBe('1 250,50');
  });
});
