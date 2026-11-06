import { describe, expect, it } from 'vitest';
import type { AuditLog } from '../../employees/entities/audit-log.entity.js';
import { changedFields, entityHistory } from './entity-history.utils.js';

describe('журнал юрособи', () => {
  it('записує лише змінені поля, «до» і «після»', () => {
    const before = { headName: 'Іван ПРИКЛАДНИЙ', headPosition: 'Директор', shortName: '' };
    const after = { headName: 'Петро ЗРАЗКОВИЙ', headPosition: 'Директор', shortName: undefined as unknown as string };
    expect(changedFields(before, after, ['headName', 'headPosition', 'shortName'])).toEqual({
      headName: ['Іван ПРИКЛАДНИЙ', 'Петро ЗРАЗКОВИЙ'],
    });
  });

  it('підписує поля доступу й квоти', () => {
    const [entry] = entityHistory([
      {
        id: 'a1',
        action: 'UPDATE',
        userName: 'Адміністратор',
        createdAt: new Date('2026-11-05T10:00:00Z'),
        diff: { HEAD_ACCESS: ['old@example.com', 'new@example.com'], reservationQuotaPercent: [null, 50] },
      } as unknown as AuditLog,
    ]);
    expect(entry.actionLabel).toBe('Змінено дані');
    expect(entry.changes).toEqual([
      {
        field: 'HEAD_ACCESS',
        label: 'Доступ керівника до системи (логін)',
        from: 'old@example.com',
        to: 'new@example.com',
      },
      { field: 'reservationQuotaPercent', label: 'Квота бронювання, %', from: '—', to: '50%' },
    ]);
  });
});
