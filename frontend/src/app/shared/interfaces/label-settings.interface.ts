/** SHEET — labels on A4 that are cut out (or a sheet of stickers); ENVELOPE — printed right on the envelope. */
export type LabelMode = 'SHEET' | 'ENVELOPE';

/** Envelope formats (ISO 269): DL 220×110, C6 162×114, C5 229×162, C4 324×229 mm. */
export type EnvelopeFormat = 'DL' | 'C6' | 'C5' | 'C4';

export type LabelFont = 'Times New Roman' | 'Arial' | 'Calibri' | 'Courier New';

/** On one label: the sender to the left of the recipient, or above him. */
export type LabelLayout = 'SIDE_BY_SIDE' | 'STACKED';

export type LabelAlign = 'left' | 'center';

/** How the envelope labels of a legal entity look: text sizes in points, everything else in millimetres. */
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
  showTitles: boolean;
  showPhone: boolean;
  postalPrefix: boolean;
  layout: LabelLayout;
  columns: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  paddingMm: number;
  cutBorder: boolean;
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

export type EnvelopePlacement = Pick<
  LabelSettings,
  'senderXMm' | 'senderYMm' | 'senderWidthMm' | 'recipientXMm' | 'recipientYMm' | 'recipientWidthMm'
>;

/** Sender or recipient on a label. */
export interface LabelParty {
  name: string;
  address: string;
  postalCode: string;
  phone: string;
}

export interface EnvelopeLabel {
  sender: LabelParty;
  recipient: LabelParty;
}

/** GET /legal-entities/:id/label-settings — the saved settings and a label of this entity for the preview. */
export interface LabelSettingsPage {
  settings: LabelSettings;
  sample: EnvelopeLabel;
}

/** The settings page: the label settings and the name of the legal entity. */
export interface LabelSettingsPageData extends LabelSettingsPage {
  entityId: string;
  entityName: string;
}

/** Labels of one legal entity — printed with its settings. */
export interface LabelPrintGroup {
  legalEntityId: string | null;
  settings: LabelSettings;
  labels: EnvelopeLabel[];
}

/** GET /letters/labels/print — the selected letters grouped by legal entity. */
export interface LabelPrintData {
  groups: LabelPrintGroup[];
}

/** A test print from the settings page: unsaved settings travel in the navigation state. */
export interface LabelTestPrintState {
  labelTestPrint: LabelPrintGroup;
  back: string;
}

/** One printed page: its labels, and the number of the group (each group has its own @page size). */
export interface LabelPage {
  group: number;
  settings: LabelSettings;
  labels: EnvelopeLabel[];
}

/** A problem of the settings bound to a form field. */
export interface LabelFieldProblem {
  field: keyof LabelSettings;
  message: string;
}
