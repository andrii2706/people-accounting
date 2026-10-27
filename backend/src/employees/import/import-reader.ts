/**
 * Reads the uploaded table (.xlsx or .csv) into rows of raw cell values.
 * The header row is found automatically: 1C reports put a title above it.
 */
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { columnForHeader } from './import-columns.js';

export type RawCell = string | number | boolean | Date | null;

export interface RawTable {
  headers: string[];
  /** rowNumber — the row number in the file, as the user sees it in Excel. */
  rows: { rowNumber: number; cells: RawCell[] }[];
}

export const MAX_IMPORT_ROWS = 1000;
const HEADER_SCAN_ROWS = 25;

const fail = (message: string) => new BadRequestException({ statusCode: 400, error: 'Bad Request', message: [message] });

export async function readTable(buffer: Buffer, fileName: string): Promise<RawTable> {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  let grid: { rowNumber: number; cells: RawCell[] }[];
  if (ext === 'xlsx') grid = await readXlsx(buffer);
  else if (ext === 'csv' || ext === 'txt') grid = readCsv(buffer);
  else if (ext === 'xls' || ext === 'xlsb' || ext === 'mxl' || ext === 'ods') {
    throw fail('Цей формат не підтримується. Відкрийте файл в Excel і збережіть як .xlsx («Файл → Зберегти як») або вивантажте з 1С у .xlsx чи .csv.');
  } else {
    throw fail('Завантажте файл .xlsx або .csv');
  }

  const headerAt = grid.slice(0, HEADER_SCAN_ROWS).findIndex((row) => row.cells.filter((c) => typeof c === 'string' && columnForHeader(c)).length >= 2);
  if (headerAt < 0) {
    throw fail('Не знайдено рядок із заголовками колонок (Прізвище, Ім’я, Дата народження…). Скористайтеся шаблоном для імпорту.');
  }
  const headers = grid[headerAt].cells.map((c) => (c === null ? '' : String(c).trim()));
  const rows = grid.slice(headerAt + 1).filter((r) => r.cells.some((c) => c !== null && String(c).trim() !== ''));
  if (!rows.length) throw fail('У файлі немає рядків з даними під заголовками');
  if (rows.length > MAX_IMPORT_ROWS) throw fail(`Забагато рядків: ${rows.length}. За один раз — не більше ${MAX_IMPORT_ROWS}.`);
  return { headers, rows };
}

// ------------------------------------------------------------------ xlsx

async function readXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw fail('Не вдалося прочитати файл Excel. Перевірте, що це .xlsx і він не захищений паролем.');
  }
  // the sheet named «Працівники» (our template), otherwise the first one with recognizable headers
  const sheets = workbook.worksheets.filter((s) => s.state === 'visible');
  const preferred = sheets.find((s) => s.name.trim().toLowerCase() === 'працівники');
  for (const sheet of preferred ? [preferred, ...sheets.filter((s) => s !== preferred)] : sheets) {
    const grid: { rowNumber: number; cells: RawCell[] }[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: RawCell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellValue(cell.value);
      });
      grid.push({ rowNumber, cells: Array.from(cells, (c) => c ?? null) });
    });
    const hasHeader = grid.slice(0, HEADER_SCAN_ROWS).some((r) => r.cells.filter((c) => typeof c === 'string' && columnForHeader(c)).length >= 2);
    if (hasHeader) return grid;
  }
  return [];
}

function cellValue(value: ExcelJS.CellValue): RawCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('result' in value) return cellValue((value.result ?? null) as ExcelJS.CellValue);
    if ('text' in value) return String(value.text);
    if ('error' in value) return null;
  }
  return String(value as unknown);
}

// ------------------------------------------------------------------ csv

function readCsv(buffer: Buffer) {
  // 1C often saves CSV in Windows-1251; UTF-8 is tried first
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('�')) text = new TextDecoder('windows-1251').decode(buffer);
  text = text.replace(/^﻿/, '');
  const firstLines = text.split(/\r?\n/).slice(0, 10).join('\n');
  const delimiter = [';', '\t', ','].map((d) => [d, firstLines.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  return parseCsv(text, delimiter).map((cells, i) => ({ rowNumber: i + 1, cells: cells.map((c) => (c.trim() === '' ? null : c)) }));
}

/** RFC 4180: quoted fields, doubled quotes, line breaks inside quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
