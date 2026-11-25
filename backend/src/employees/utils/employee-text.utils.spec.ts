import { describe, expect, it } from 'vitest';
import type { Employee } from '../entities/employee.entity.js';
import { quotaReason, shortName } from './employee-text.utils.js';

const withPatch = (patch: Partial<Employee>) => ({ ...base, ...patch }) as Employee;
const base = {
  lastName: 'Зразкова',
  firstName: 'марія',
  middleName: 'Іванівна',
  legalEntityId: 'a',
  dismissalDate: null,
  reserved: false,
  hireDate: '2020-01-01',
} as unknown as Employee;

describe('shortName', () => {
  it('surname and initials', () => {
    expect(shortName(base)).toBe('Зразкова М. І.');
    expect(shortName(withPatch({ middleName: '' }))).toBe('Зразкова М.');
  });
});

describe('quotaReason', () => {
  it('names what moved the quota', () => {
    expect(quotaReason(base, withPatch({ dismissalDate: '2026-11-19' }))).toBe('Звільнено: Зразкова М. І.');
    expect(quotaReason(base, withPatch({ reserved: true }))).toBe('Заброньовано: Зразкова М. І.');
    expect(quotaReason(base, withPatch({ legalEntityId: 'b' }))).toBe('Переведено до іншої юрособи: Зразкова М. І.');
    expect(quotaReason(base, withPatch({ hireDate: '2020-02-01' }))).toBe('Змінено облікові дані: Зразкова М. І.');
  });

  it('nothing for a phone or an address', () => {
    expect(quotaReason(base, withPatch({ phone: '+380000000000' }))).toBe('');
  });
});
