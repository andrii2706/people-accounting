/** Невеликий набір будівельних блоків поверх бібліотеки `docx` для офіційних документів. */
import {
  AlignmentType,
  BorderStyle,
  Document,
  type FileChild,
  type ISectionOptions,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

export const FONT = 'Times New Roman';
/** Розмір шрифту в пунктах. */
const pt = (size: number) => size * 2;

export interface TextOpts {
  size?: number;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: number;
  spacingAfter?: number;
  spacingBefore?: number;
  keepNext?: boolean;
}

const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const;

export function p(text: string | TextRun[], opts: TextOpts = {}): Paragraph {
  const runs = typeof text === 'string'
    ? text.split('\n').map((line, i) => new TextRun({
        text: line,
        break: i > 0 ? 1 : undefined,
        bold: opts.bold,
        italics: opts.italics,
        underline: opts.underline ? {} : undefined,
        size: pt(opts.size ?? 12),
        font: FONT,
      }))
    : text;
  return new Paragraph({
    children: runs,
    alignment: ALIGN[opts.align ?? 'left'],
    indent: opts.indent ? { firstLine: opts.indent } : undefined,
    spacing: { after: opts.spacingAfter ?? 0, before: opts.spacingBefore ?? 0 },
    keepNext: opts.keepNext,
  });
}

export function run(text: string, opts: Pick<TextOpts, 'bold' | 'italics' | 'underline' | 'size'> = {}): TextRun {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italics,
    underline: opts.underline ? {} : undefined,
    size: pt(opts.size ?? 12),
    font: FONT,
  });
}

/** Підпис під полем дрібним шрифтом, як «(підпис)» у бланках. */
export function hint(text: string, align: TextOpts['align'] = 'center'): Paragraph {
  return p(text, { size: 8, italics: true, align });
}

export function empty(count = 1): Paragraph[] {
  return Array.from({ length: count }, () => p(''));
}

export function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN = { style: BorderStyle.SINGLE, size: 4, color: '000000' };

export interface CellSpec {
  text: string;
  bold?: boolean;
  align?: TextOpts['align'];
  size?: number;
  colSpan?: number;
}

/** Таблиця з рамками. widths — у twips (1 см ≈ 567). */
export function table(
  header: (string | CellSpec)[][],
  rows: (string | CellSpec)[][],
  widths: number[],
  opts: { size?: number; headerSize?: number; borders?: boolean } = {},
): Table {
  const borders = opts.borders === false
    ? { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER }
    : { top: THIN, bottom: THIN, left: THIN, right: THIN, insideHorizontal: THIN, insideVertical: THIN };

  const mkCell = (spec: string | CellSpec, width: number, isHeader: boolean) => {
    const s: CellSpec = typeof spec === 'string' ? { text: spec } : spec;
    return new TableCell({
      children: [p(s.text ?? '', {
        size: s.size ?? (isHeader ? opts.headerSize ?? 9 : opts.size ?? 9),
        bold: s.bold ?? false,
        align: s.align ?? (isHeader ? 'center' : 'left'),
      })],
      width: { size: width, type: WidthType.DXA },
      columnSpan: s.colSpan,
      verticalAlign: isHeader ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: 30, bottom: 30, left: 60, right: 60 },
    });
  };

  const mkRow = (cells: (string | CellSpec)[], isHeader: boolean) => {
    let col = 0;
    return new TableRow({
      tableHeader: isHeader,
      cantSplit: true,
      children: cells.map((c) => {
        const span = typeof c === 'string' ? 1 : c.colSpan ?? 1;
        const width = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
        col += span;
        return mkCell(c, width, isHeader);
      }),
    });
  };

  return new Table({
    rows: [...header.map((r) => mkRow(r, true)), ...rows.map((r) => mkRow(r, false))],
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
  });
}

/** Рядок без рамок з двома колонками — для «Відправник / Отримувач», підписів тощо. */
export function twoColumns(left: Paragraph[], right: Paragraph[], widths: [number, number]): Table {
  return new Table({
    rows: [new TableRow({
      children: [
        new TableCell({ children: left, width: { size: widths[0], type: WidthType.DXA } }),
        new TableCell({ children: right, width: { size: widths[1], type: WidthType.DXA } }),
      ],
    })],
    width: { size: widths[0] + widths[1], type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
  });
}

/** Блок підпису: посада — (підпис) — ініціали та прізвище. */
export function signature(position: string, name: string, widths: [number, number, number] = [4200, 2400, 3000]): Table {
  const cell = (children: Paragraph[], width: number) => new TableCell({ children, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM });
  return new Table({
    rows: [new TableRow({
      children: [
        cell([p(position || '______________________', { size: 12 })], widths[0]),
        cell([p('______________', { align: 'center' }), hint('(підпис)')], widths[1]),
        cell([p(name || '______________________', { align: 'right' }), hint('(ініціали та прізвище)', 'right')], widths[2]),
      ],
    })],
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
  });
}

export const A4 = { width: 11906, height: 16838 };

export function section(children: FileChild[], landscape = false): ISectionOptions {
  return {
    properties: {
      page: {
        size: { width: A4.width, height: A4.height, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: landscape
          ? { top: 850, bottom: 850, left: 850, right: 850 }
          : { top: 1134, bottom: 1134, left: 1701, right: 850 },
      },
    },
    children,
  };
}

/** Ширина робочої області сторінки в twips. */
export const CONTENT_WIDTH = { portrait: A4.width - 1701 - 850, landscape: A4.height - 850 - 850 };

export async function render(sections: ISectionOptions[], title: string): Promise<Buffer> {
  const doc = new Document({
    title,
    creator: 'Військовий облік',
    styles: { default: { document: { run: { font: FONT, size: pt(12) } } } },
    sections,
  });
  return Packer.toBuffer(doc);
}
