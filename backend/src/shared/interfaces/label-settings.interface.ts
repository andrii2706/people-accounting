import type { EnvelopeLabel } from './document.interface.js';

/** SHEET — labels on A4 that are cut out (or a sheet of stickers); ENVELOPE — printed right on the envelope. */
export type LabelMode = 'SHEET' | 'ENVELOPE';

/** Envelope formats (ISO 269): DL 220×110, C6 162×114, C5 229×162, C4 324×229 mm. */
export type EnvelopeFormat = 'DL' | 'C6' | 'C5' | 'C4';

export type LabelFont = 'Times New Roman' | 'Arial' | 'Calibri' | 'Courier New';

/** On one label: the sender to the left of the recipient, or above him. */
export type LabelLayout = 'SIDE_BY_SIDE' | 'STACKED';

export type LabelAlign = 'left' | 'center';

/**
 * How the envelope labels of a legal entity look. Sizes of the text — in points, everything else — in millimetres.
 * Flat on purpose: one field of the form = one key.
 */
export interface LabelSettings {
  mode: LabelMode;

  font: LabelFont;
  titleSize: number;
  nameSize: number;
  addressSize: number;
  postalSize: number;
  phoneSize: number;
  nameBold: boolean;
  postalBold: boolean;
  align: LabelAlign;

  /** «Відправник:» / «Отримувач:» above the blocks. */
  showTitles: boolean;
  showPhone: boolean;
  /** «Індекс: 79000» or just «79000». */
  postalPrefix: boolean;

  /** A4 sheet. */
  layout: LabelLayout;
  columns: number;
  labelWidthMm: number;
  labelHeightMm: number;
  /** Between the labels, horizontally and vertically. */
  gapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  /** From the border of a label to the text. */
  paddingMm: number;
  /** Dashed border to cut along. */
  cutBorder: boolean;

  /** Envelope: the top left corner of each block from the top left corner of the envelope. */
  envelope: EnvelopeFormat;
  senderXMm: number;
  senderYMm: number;
  senderWidthMm: number;
  recipientXMm: number;
  recipientYMm: number;
  recipientWidthMm: number;
}

export interface EnvelopeSize {
  widthMm: number;
  heightMm: number;
}

/** Places of the sender and the recipient that suit an envelope format. */
export type EnvelopePlacement = Pick<
  LabelSettings,
  'senderXMm' | 'senderYMm' | 'senderWidthMm' | 'recipientXMm' | 'recipientYMm' | 'recipientWidthMm'
>;

/** The settings page: the saved settings and a label of this legal entity for the preview. */
export interface LabelSettingsPage {
  settings: LabelSettings;
  sample: EnvelopeLabel;
}

/** Labels of one legal entity — they are printed with its settings. */
export interface LabelPrintGroup {
  legalEntityId: string | null;
  settings: LabelSettings;
  labels: EnvelopeLabel[];
}

/** Printing from the browser: the selected letters grouped by legal entity. */
export interface LabelPrintData {
  groups: LabelPrintGroup[];
}
