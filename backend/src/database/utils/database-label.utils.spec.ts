import { describe, expect, it } from 'vitest';
import { databaseLabel } from './database-label.utils.js';

describe('databaseLabel', () => {
  it('the host and the database, never the password', () => {
    expect(databaseLabel('postgres://postgres:secret@localhost:5432/military')).toBe('localhost:5432/military');
    expect(databaseLabel('postgres://u:p@/military?host=/cloudsql/p:r:i')).toBe('/cloudsql/p:r:i/military');
    expect(databaseLabel('postgres://u:p@db/hr')).toBe('db:5432/hr');
  });
});
