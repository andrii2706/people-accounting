import { describe, expect, it } from 'vitest';
import { buildStatement } from './statement.utils.js';

describe('buildStatement', () => {
  const input = {
    id: '00000000-0000-4000-8000-000000000001',
    edrpou: '12345678',
    email: 'head@example.com',
    createdAt: new Date('2026-11-12T10:05:00Z'),
  };

  it('містить код, пошту, номер і київський час', () => {
    const text = buildStatement(input);
    expect(text).toContain('Код за ЄДРПОУ: 12345678');
    expect(text).toContain('head@example.com');
    expect(text).toContain('Номер заяви: 00000000-0000-4000-8000-000000000001');
    expect(text).toContain('12.11.2026, 12:05');
  });

  it('однакові дані — однаковий текст (підпис стосується саме його)', () => {
    expect(buildStatement(input)).toBe(buildStatement({ ...input }));
    expect(buildStatement(input)).not.toBe(buildStatement({ ...input, email: 'other@example.com' }));
  });
});
