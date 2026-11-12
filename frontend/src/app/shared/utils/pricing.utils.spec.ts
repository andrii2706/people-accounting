import { describe, expect, it } from 'vitest';
import { parsePrice } from './pricing.utils';

describe('ціна тарифу', () => {
  it('порожньо — тариф не пропонується; кома чи крапка; пробіли між розрядами', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('749')).toBe(749);
    expect(parsePrice('1 250,50')).toBe(1250.5);
    expect(parsePrice('7490.9')).toBe(7490.9);
    expect(parsePrice('12,345')).toBeNaN();
    expect(parsePrice('abc')).toBeNaN();
  });
});
