import { describe, expect, it } from 'vitest';
import { NOTICE_CHANGE_TYPES } from './employees.constants.js';

describe('підстави для повідомлення ТЦК (додаток 4)', () => {
  it('лише ПІБ, паспорт, адреси, посада, прийняття і звільнення', () => {
    expect([...NOTICE_CHANGE_TYPES].sort()).toEqual(
      [
        'ACTUAL_ADDRESS',
        'DISMISSAL',
        'FIRST_NAME',
        'HIRE',
        'LAST_NAME',
        'MIDDLE_NAME',
        'PASSPORT',
        'POSITION',
        'REGISTERED_ADDRESS',
      ].sort(),
    );
  });

  it('військові дані, освіта, сімейний стан, закордонний паспорт — не повідомляються', () => {
    for (const type of [
      'RANK',
      'VOS',
      'MILITARY_DOC',
      'TCK',
      'FITNESS',
      'EDUCATION',
      'MARITAL_STATUS',
      'FOREIGN_PASSPORT',
    ]) {
      expect(NOTICE_CHANGE_TYPES).not.toContain(type);
    }
  });
});
