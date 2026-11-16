import { describe, expect, it } from 'vitest';
import { columnItems, fileSize, toggleColumn, withNumberFirst } from './list-settings.utils';

describe('list settings', () => {
  it('a column on goes to the end, «№» cannot be switched off', () => {
    expect(toggleColumn(['number', 'fullName'], 'rank', true)).toEqual([
      'number',
      'fullName',
      'rank',
    ]);
    expect(toggleColumn(['number', 'fullName', 'rank'], 'fullName', false)).toEqual([
      'number',
      'rank',
    ]);
    expect(toggleColumn(['number', 'fullName'], 'number', false)).toEqual(['number', 'fullName']);
  });

  it('the sortable list holds the columns after «№», the new order keeps «№» first', () => {
    expect(columnItems(['number', 'fullName', 'rank']).map((i) => i.value)).toEqual([
      'fullName',
      'rank',
    ]);
    expect(columnItems(['number', 'fullName'])[0].label).toBe('ПІБ · гр. 4');
    expect(withNumberFirst(['rank', 'fullName'])).toEqual(['number', 'rank', 'fullName']);
  });

  it('file sizes', () => {
    expect(fileSize(12320)).toBe('12 КБ');
    expect(fileSize(3 * 1024 * 1024)).toBe('3,0 МБ');
  });
});
