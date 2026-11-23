import { describe, expect, it } from 'vitest';
import { estimatePages, lineHeight, rowHeight, textLines } from './page-estimate.utils.js';

describe('the estimate of pages', () => {
  it('wraps word by word', () => {
    // 8 pt: a character ≈ 77 twips — 1000 twips hold 13 characters
    expect(textLines('', 8, 1000)).toBe(1);
    expect(textLines('коротко', 8, 1000)).toBe(1);
    expect(textLines('дуже довгий текст у вузькій графі', 8, 1000)).toBe(3);
    expect(textLines('рядок\nдругий', 8, 1000)).toBe(2);
    // a word longer than the line breaks inside it
    expect(textLines('a'.repeat(30), 8, 1000)).toBe(3);
  });

  it('a row is as tall as its tallest cell', () => {
    const short = rowHeight([{ text: 'так', size: 8 }], [1000]);
    const tall = rowHeight(
      [
        { text: 'так', size: 8 },
        { text: 'дуже довгий текст у вузькій графі', size: 8 },
      ],
      [1000, 1000],
    );
    // the cell is narrower by its margins (120 twips): the long text takes 4 lines there
    expect(textLines('дуже довгий текст у вузькій графі', 8, 880)).toBe(4);
    expect(tall - short).toBeCloseTo(3 * lineHeight(8));
  });

  it('rows go to the next page whole, under the repeated header', () => {
    const row = [{ text: 'рядок', size: 8 }];
    const one = rowHeight(row, [5000]);
    const input = (rows: number) => ({
      pageHeight: one * 10,
      widths: [5000],
      before: [],
      header: [row],
      rows: Array.from({ length: rows }, () => row),
      after: [],
    });
    expect(estimatePages(input(9))).toBe(1); // header + 9 rows = 10
    expect(estimatePages(input(10))).toBe(2);
    expect(estimatePages(input(18))).toBe(2);
    expect(estimatePages(input(19))).toBe(3);
  });
});
