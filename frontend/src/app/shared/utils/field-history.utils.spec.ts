import { describe, expect, it } from 'vitest';
import type { FieldHistoryEntry } from '../interfaces/employee.interface';
import { contactHistoryLines, lastChange, previousTcks, sinceText } from './field-history.utils';

const row = (p: Partial<FieldHistoryEntry>): FieldHistoryEntry => ({
  id: 'h',
  field: 'phone',
  oldValue: '',
  newValue: '',
  effectiveDate: '2026-11-12',
  oldEffectiveDate: null,
  basis: '',
  createdAt: '2026-11-12T10:00:00Z',
  ...p,
});

describe('field history', () => {
  const history = [
    row({
      field: 'phone',
      oldValue: '+380000000000',
      newValue: '+380000000001',
      effectiveDate: '2026-11-12',
    }),
    row({
      field: 'tck',
      oldValue: 'Франківський РТЦК та СП',
      newValue: 'Шевченківський РТЦК та СП',
      effectiveDate: '2024-03-01',
      oldEffectiveDate: '2019-06-05',
    }),
    row({ field: 'phone', oldValue: '', newValue: '+380000000000', effectiveDate: '2025-01-10' }),
  ];

  it('the last change and since when', () => {
    expect(lastChange(history, 'phone')?.effectiveDate).toBe('2026-11-12');
    expect(lastChange(history, 'email')).toBeNull();
    expect(sinceText('2026-11-12')).toBe('з 12.11.2026');
    expect(sinceText(null)).toBe('');
  });

  it('the earlier TCKs', () => {
    expect(previousTcks(history)).toEqual([
      'до 01.03.2024 · Франківський РТЦК та СП (з 05.06.2019)',
    ]);
  });

  it('the lines of the contact history', () => {
    expect(contactHistoryLines(history, { phone: 'Телефон' })).toEqual([
      '12.11.2026 · Телефон: +380000000000 → +380000000001',
      '10.01.2025 · Телефон: — → +380000000000',
    ]);
  });
});
