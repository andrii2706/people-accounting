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
} from '../shared/interfaces/label-settings.interface.js';

export const A4_MM: EnvelopeSize = { widthMm: 210, heightMm: 297 };

/** Bottom / right edge of the page that printers do not reach, mm. */
export const PRINT_EDGE_MM = 5;
/** Room for the last (1 pt) paragraph of a page in the .docx, so that it does not spill onto an empty page, mm. */
export const PAGE_TAIL_MM = 2;

export const ENVELOPE_SIZES: Record<EnvelopeFormat, EnvelopeSize> = {
  DL: { widthMm: 220, heightMm: 110 },
  C6: { widthMm: 162, heightMm: 114 },
  C5: { widthMm: 229, heightMm: 162 },
  C4: { widthMm: 324, heightMm: 229 },
};

/** Sender in the top left corner, recipient in the bottom right half — as Ukrposhta asks. */
export const ENVELOPE_PLACEMENTS: Record<EnvelopeFormat, EnvelopePlacement> = {
  DL: { senderXMm: 10, senderYMm: 10, senderWidthMm: 85, recipientXMm: 110, recipientYMm: 50, recipientWidthMm: 100 },
  C6: { senderXMm: 8, senderYMm: 8, senderWidthMm: 70, recipientXMm: 75, recipientYMm: 50, recipientWidthMm: 80 },
  C5: { senderXMm: 10, senderYMm: 10, senderWidthMm: 90, recipientXMm: 115, recipientYMm: 80, recipientWidthMm: 105 },
  C4: { senderXMm: 15, senderYMm: 15, senderWidthMm: 110, recipientXMm: 170, recipientYMm: 120, recipientWidthMm: 140 },
};

export const LABEL_MODES: LabelMode[] = ['SHEET', 'ENVELOPE'];
export const ENVELOPE_FORMATS: EnvelopeFormat[] = ['DL', 'C6', 'C5', 'C4'];
export const LABEL_FONTS: LabelFont[] = ['Times New Roman', 'Arial', 'Calibri', 'Courier New'];
export const LABEL_LAYOUTS: LabelLayout[] = ['SIDE_BY_SIDE', 'STACKED'];
export const LABEL_ALIGNS: LabelAlign[] = ['left', 'center'];
export const LABEL_TITLE_STYLES: LabelTitleStyle[] = ['UKRPOSHTA', 'CLASSIC'];
export const POSTAL_STYLES: PostalStyle[] = ['BOXES', 'TEXT'];
/** As Ukrposhta asks: the name, the address, the index the last line of the address; the phone apart. */
export const LABEL_LINES: LabelLine[] = ['name', 'address', 'phone', 'postalCode'];
export const LABEL_PARTIES: LabelPartyKey[] = ['sender', 'recipient'];

/** Titles of the blocks. */
export const LABEL_TITLES: Record<LabelTitleStyle, Record<LabelPartyKey, string>> = {
  UKRPOSHTA: { sender: 'Від кого:', recipient: 'Кому:' },
  CLASSIC: { sender: 'Відправник:', recipient: 'Отримувач:' },
};

/** Digits of a Ukrainian postal index — the number of cells. */
export const POSTAL_CODE_DIGITS = 5;

/** Times New Roman, one label across A4, sender | recipient, the template of Ukrposhta. */
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

/** Limits of the numeric settings: [min, max]. */
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

/** Text sizes, points. */
export const LABEL_TEXT_SIZE_FIELDS = ['titleSize', 'nameSize', 'addressSize', 'postalSize', 'phoneSize'] as const;

/** All keys — compared for the journal. */
export const LABEL_SETTING_FIELDS = Object.keys(DEFAULT_LABEL_SETTINGS) as (keyof LabelSettings)[];

/** Journal of a legal entity: the keys of the label settings are written as «label:<key>». */
export const LABEL_JOURNAL_PREFIX = 'label:';

/** Readable values for the journal. */
export const LABEL_VALUE_TEXT: Record<string, string> = {
  SHEET: 'наклейки на A4',
  ENVELOPE: 'друк на конверті',
  UKRPOSHTA: '«Від кого / Кому» (Укрпошта)',
  CLASSIC: '«Відправник / Отримувач»',
  BOXES: 'у клітинках',
  TEXT: 'текстом',
  name: 'назва',
  address: 'адреса',
  postalCode: 'індекс',
  phone: 'телефон',
  sender: 'відправник',
  recipient: 'отримувач',
  SIDE_BY_SIDE: 'поруч',
  STACKED: 'одне під одним',
  left: 'ліворуч',
  center: 'по центру',
  true: 'так',
  false: 'ні',
};

export const SAMPLE_RECIPIENT = {
  name: 'Львівський обласний ТЦК та СП',
  address: 'вул. Прикладна, 1, м. Львів',
  postalCode: '79000',
  phone: '',
};
