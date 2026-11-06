import type { SelectOption } from '../interfaces/ui.interface';
import type {
  EnvelopeFormat,
  EnvelopePlacement,
  EnvelopeSize,
  LabelAlign,
  LabelFont,
  LabelLayout,
  LabelLine,
  LabelMode,
  LabelPartyKey,
  LabelSettings,
  LabelTitleStyle,
  PostalStyle,
} from '../interfaces/label-settings.interface';

/** The same values as on the server (documents/label-settings.constants.ts). */
export const A4_MM: EnvelopeSize = { widthMm: 210, heightMm: 297 };
export const PRINT_EDGE_MM = 5;
export const PAGE_TAIL_MM = 2;

export const ENVELOPE_SIZES: Record<EnvelopeFormat, EnvelopeSize> = {
  DL: { widthMm: 220, heightMm: 110 },
  C6: { widthMm: 162, heightMm: 114 },
  C5: { widthMm: 229, heightMm: 162 },
  C4: { widthMm: 324, heightMm: 229 },
};

export const ENVELOPE_PLACEMENTS: Record<EnvelopeFormat, EnvelopePlacement> = {
  DL: {
    senderXMm: 10,
    senderYMm: 10,
    senderWidthMm: 85,
    recipientXMm: 110,
    recipientYMm: 50,
    recipientWidthMm: 100,
  },
  C6: {
    senderXMm: 8,
    senderYMm: 8,
    senderWidthMm: 70,
    recipientXMm: 75,
    recipientYMm: 50,
    recipientWidthMm: 80,
  },
  C5: {
    senderXMm: 10,
    senderYMm: 10,
    senderWidthMm: 90,
    recipientXMm: 115,
    recipientYMm: 80,
    recipientWidthMm: 105,
  },
  C4: {
    senderXMm: 15,
    senderYMm: 15,
    senderWidthMm: 110,
    recipientXMm: 170,
    recipientYMm: 120,
    recipientWidthMm: 140,
  },
};

/** As Ukrposhta asks: the name, the address, the index the last line; the phone apart. */
export const LABEL_LINES: LabelLine[] = ['name', 'address', 'phone', 'postalCode'];
export const LABEL_PARTIES: LabelPartyKey[] = ['sender', 'recipient'];

export const LABEL_LINE_LABELS: Record<LabelLine, string> = {
  name: 'Назва',
  address: 'Адреса',
  postalCode: 'Індекс',
  phone: 'Телефон',
};

export const LABEL_PARTY_LABELS: Record<LabelPartyKey, string> = {
  sender: 'Відправник (юрособа)',
  recipient: 'Отримувач (ТЦК)',
};

export const LABEL_TITLES: Record<LabelTitleStyle, Record<LabelPartyKey, string>> = {
  UKRPOSHTA: { sender: 'Від кого:', recipient: 'Кому:' },
  CLASSIC: { sender: 'Відправник:', recipient: 'Отримувач:' },
};

export const POSTAL_CODE_DIGITS = 5;

export const LABEL_TITLE_STYLE_OPTIONS: { value: LabelTitleStyle; label: string }[] = [
  { value: 'UKRPOSHTA', label: '«Від кого» / «Кому»' },
  { value: 'CLASSIC', label: '«Відправник» / «Отримувач»' },
];

export const POSTAL_STYLE_OPTIONS: { value: PostalStyle; label: string }[] = [
  { value: 'BOXES', label: 'У клітинках' },
  { value: 'TEXT', label: 'Текстом' },
];

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  mode: 'SHEET',
  font: 'Times New Roman',
  titleSize: 11,
  nameSize: 13,
  addressSize: 12,
  postalSize: 14,
  phoneSize: 11,
  nameBold: true,
  postalBold: true,
  align: 'left',
  showTitles: true,
  titleStyle: 'UKRPOSHTA',
  postalStyle: 'BOXES',
  lineOrder: [...LABEL_LINES],
  partyOrder: [...LABEL_PARTIES],
  showPhone: true,
  postalPrefix: true,
  layout: 'SIDE_BY_SIDE',
  columns: 1,
  labelWidthMm: 165,
  labelHeightMm: 55,
  gapMm: 4,
  marginTopMm: 20,
  marginLeftMm: 30,
  paddingMm: 3,
  cutBorder: true,
  envelope: 'DL',
  ...ENVELOPE_PLACEMENTS.DL,
};

export const LABEL_LIMITS = {
  textSize: [6, 28],
  columns: [1, 3],
  labelWidthMm: [40, 200],
  labelHeightMm: [20, 280],
  gapMm: [0, 20],
  marginMm: [0, 60],
  paddingMm: [0, 10],
  positionMm: [0, 320],
  blockWidthMm: [30, 300],
} as const;

export const LABEL_MODE_OPTIONS: { value: LabelMode; label: string; hint: string }[] = [
  { value: 'SHEET', label: 'Наклейки на A4', hint: 'Розрізати або аркуш самоклейок' },
  { value: 'ENVELOPE', label: 'Друк на конверті', hint: 'Конверт вставляється в принтер' },
];

export const LABEL_FONT_OPTIONS: SelectOption<LabelFont>[] = [
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Courier New', label: 'Courier New' },
];

export const ENVELOPE_OPTIONS: SelectOption<EnvelopeFormat>[] = (
  Object.keys(ENVELOPE_SIZES) as EnvelopeFormat[]
).map((value) => ({
  value,
  label: `${value} — ${ENVELOPE_SIZES[value].widthMm}×${ENVELOPE_SIZES[value].heightMm} мм`,
}));

export const LABEL_LAYOUT_OPTIONS: { value: LabelLayout; label: string }[] = [
  { value: 'SIDE_BY_SIDE', label: 'Відправник | Отримувач' },
  { value: 'STACKED', label: 'Одне під одним' },
];

export const LABEL_ALIGN_OPTIONS: { value: LabelAlign; label: string }[] = [
  { value: 'left', label: 'Ліворуч' },
  { value: 'center', label: 'По центру' },
];

export const LABEL_COLUMN_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 — на всю ширину' },
  { value: '2', label: '2 в ряд' },
  { value: '3', label: '3 в ряд' },
];

/** The font on screen and when printed from the browser: metric-compatible free fonts as a fallback. */
export const LABEL_FONT_STACKS: Record<LabelFont, string> = {
  'Times New Roman': "'Times New Roman', 'Liberation Serif', 'Tinos', serif",
  Arial: "Arial, 'Liberation Sans', 'Arimo', Helvetica, sans-serif",
  Calibri: "Calibri, 'Carlito', 'Segoe UI', sans-serif",
  'Courier New': "'Courier New', 'Liberation Mono', 'Cousine', monospace",
};

/** The print page: white paper even with «background graphics» on. */
export const PRINT_PAGE_RULES = '@media print { html, body { background: #fff !important; } }';

/** CSS pixels in a millimetre (96 dpi). */
export const PX_PER_MM = 96 / 25.4;

/** Width of the preview on the settings page, px. */
export const LABEL_PREVIEW_WIDTH_PX = 520;

type NumberField = {
  [K in keyof LabelSettings]: LabelSettings[K] extends number ? K : never;
}[keyof LabelSettings];

/** Numeric fields of the form: [field, min, max, unit] — the same limits as on the server. */
export const LABEL_NUMBER_RULES: [NumberField, number, number, string][] = [
  ...(['titleSize', 'nameSize', 'addressSize', 'postalSize', 'phoneSize'] as const).map(
    (k): [NumberField, number, number, string] => [k, ...LABEL_LIMITS.textSize, 'пт'],
  ),
  ['columns', ...LABEL_LIMITS.columns, ''],
  ['labelWidthMm', ...LABEL_LIMITS.labelWidthMm, 'мм'],
  ['labelHeightMm', ...LABEL_LIMITS.labelHeightMm, 'мм'],
  ['gapMm', ...LABEL_LIMITS.gapMm, 'мм'],
  ['marginTopMm', ...LABEL_LIMITS.marginMm, 'мм'],
  ['marginLeftMm', ...LABEL_LIMITS.marginMm, 'мм'],
  ['paddingMm', ...LABEL_LIMITS.paddingMm, 'мм'],
  ['senderXMm', ...LABEL_LIMITS.positionMm, 'мм'],
  ['senderYMm', ...LABEL_LIMITS.positionMm, 'мм'],
  ['senderWidthMm', ...LABEL_LIMITS.blockWidthMm, 'мм'],
  ['recipientXMm', ...LABEL_LIMITS.positionMm, 'мм'],
  ['recipientYMm', ...LABEL_LIMITS.positionMm, 'мм'],
  ['recipientWidthMm', ...LABEL_LIMITS.blockWidthMm, 'мм'],
];

/** Fields that get the «does not fit on the paper» messages. */
export const LABEL_GEOMETRY_FIELDS: (keyof LabelSettings)[] = [
  'labelWidthMm',
  'labelHeightMm',
  'paddingMm',
  'senderWidthMm',
  'recipientWidthMm',
  'recipientXMm',
  'recipientYMm',
];
