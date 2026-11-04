import { describe, expect, it } from 'vitest';
import { groupByEntity } from '../../notifications/utils/group-by-entity.utils.js';
import { parsePerson } from './person.utils.js';

describe('керівник / відповідальний', () => {
  it('особа з адреси запиту', () => {
    expect(parsePerson('head')).toBe('HEAD');
    expect(parsePerson('responsible')).toBe('RESPONSIBLE');
    expect(() => parsePerson('boss')).toThrow();
  });

  it('нагадування групуються по юрособах', () => {
    const groups = groupByEntity(
      [
        { id: 1, e: 'a' },
        { id: 2, e: 'b' },
        { id: 3, e: 'a' },
        { id: 4, e: null },
      ],
      (x) => x.e,
    );
    expect([...groups.entries()].map(([k, v]) => [k, v.map((x) => x.id)])).toEqual([
      ['a', [1, 3]],
      ['b', [2]],
      [null, [4]],
    ]);
  });
});
