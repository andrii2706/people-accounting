/**
 * How many pages a built-in document takes, counted the way Word lays it out — near enough to put the number of
 * sheets into a cover letter instead of a blank for the pen. Times New Roman: a character is about half of the
 * size wide, a line is 1.15 of the size high; a table row never splits (cantSplit), the header rows repeat on
 * every page.
 */
import type { PageEstimateCell, PageEstimateInput } from '../../shared/interfaces/document.interface.js';

/** Twips in a point. */
const TWIPS_PER_PT = 20;
/** The average width of a character of Times New Roman (Ukrainian text, digits), in sizes. */
export const CHAR_WIDTH_EM = 0.48;
/** Single line spacing of Times New Roman, in sizes. */
export const LINE_HEIGHT_EM = 1.15;
/** Cell margins of the tables of the documents: left + right, top + bottom (docx-kit), twips. */
const CELL_PADDING_X = 120;
const CELL_PADDING_Y = 60;
/** The borders of a row, twips. */
const ROW_BORDERS = 10;

/** The height of one line of text of this size, twips. */
export const lineHeight = (size: number) => size * TWIPS_PER_PT * LINE_HEIGHT_EM;

/** Lines a text takes in a width (twips): word by word, as Word wraps it; an empty text — one line. */
export function textLines(text: string, size: number, width: number): number {
  const perLine = Math.max(1, Math.floor(width / (size * TWIPS_PER_PT * CHAR_WIDTH_EM)));
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let used = 0;
    let count = 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      // a word longer than a line breaks inside
      const long = Math.ceil(word.length / perLine);
      if (long > 1) {
        count += used ? long : long - 1;
        used = word.length % perLine || perLine;
        continue;
      }
      const need = used ? used + 1 + word.length : word.length;
      if (need > perLine) {
        count++;
        used = word.length;
      } else {
        used = need;
      }
    }
    lines += count;
  }
  return Math.max(1, lines);
}

/** The height of a table row (twips): its tallest cell. */
export function rowHeight(cells: PageEstimateCell[], widths: number[]): number {
  let col = 0;
  let tallest = 0;
  for (const cell of cells) {
    const span = cell.colSpan ?? 1;
    const width = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
    col += span;
    const h = textLines(cell.text, cell.size, Math.max(1, width - CELL_PADDING_X)) * lineHeight(cell.size);
    tallest = Math.max(tallest, h);
  }
  return tallest + CELL_PADDING_Y + ROW_BORDERS;
}

/** Pages of a page of text before the table, the table and the text after it. */
export function estimatePages(input: PageEstimateInput): number {
  const { pageHeight, widths } = input;
  let pages = 1;
  let y = 0;
  const flow = (h: number) => {
    if (y + h > pageHeight && y > 0) {
      pages++;
      y = 0;
    }
    y += h;
  };
  for (const b of input.before) flow(b.height);
  const header = input.header.reduce((sum, row) => sum + rowHeight(row, widths), 0);
  // the header goes to the next page together with the first row
  const first = input.rows.length ? rowHeight(input.rows[0], widths) : 0;
  if (y + header + first > pageHeight && y > 0) {
    pages++;
    y = 0;
  }
  y += header;
  for (const row of input.rows) {
    const h = rowHeight(row, widths);
    if (y + h > pageHeight) {
      pages++;
      y = header;
    }
    y += h;
  }
  for (const b of input.after) flow(b.height);
  return pages;
}
