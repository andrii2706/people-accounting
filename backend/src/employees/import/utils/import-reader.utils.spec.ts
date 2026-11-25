import { describe, expect, it } from 'vitest';
import { paddedNumber } from './import-reader.utils.js';

describe('paddedNumber', () => {
  it('keeps the leading zeros Excel shows', () => {
    expect(paddedNumber(1, '000')).toBe('001');
    expect(paddedNumber(42, '0000')).toBe('0042');
  });

  it('other numbers and formats — as before', () => {
    expect(paddedNumber(1, 'General')).toBeNull();
    expect(paddedNumber(1.5, '000')).toBeNull();
    expect(paddedNumber('001', '000')).toBeNull();
    expect(paddedNumber(7, '0')).toBeNull();
  });
});
