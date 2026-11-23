import type { LabelFont } from './label-settings.interface.js';

/** The name at the top of the letterhead: the full one from ЄДР, the short one, or written by the company. */
export type LetterheadTitle = 'FULL' | 'SHORT' | 'CUSTOM';

export type LetterheadAlign = 'left' | 'center';

/**
 * The letterhead (бланк) of the letters of a legal entity: the name, the address, the code, the contacts — taken
 * from its requisites when a letter is made; the company chooses only what is shown and how.
 */
export interface LetterheadSettings {
  /** Print the letterhead on the cover letters (off — the requisites in the corner, as before). */
  enabled: boolean;
  font: LabelFont;
  /** The name, points. */
  titleSize: number;
  /** The address, the code, the contacts, points. */
  textSize: number;
  titleBold: boolean;
  titleAlign: LetterheadAlign;
  title: LetterheadTitle;
  /** The name when title = CUSTOM. */
  customTitle: string;
  showAddress: boolean;
  showCode: boolean;
  showPhone: boolean;
  showEmail: boolean;
  /** One more line under the contacts: a site, the bank account … ('' — none). */
  extraLine: string;
  /** The line under the letterhead. */
  rule: boolean;
}

/** What the letterhead says, line by line ('' — not shown). */
export interface LetterheadContent {
  title: string;
  address: string;
  code: string;
  contacts: string;
  extra: string;
}

/** The requisites of the legal entity the letterhead is made of (the preview of the settings page). */
export interface LetterheadRequisites {
  fullName: string;
  shortName: string;
  address: string;
  postalCode: string;
  edrpou: string;
  phone: string;
  email: string;
}

/** The settings page: the saved settings and the requisites of this legal entity for the preview. */
export interface LetterheadSettingsPage {
  settings: LetterheadSettings;
  requisites: LetterheadRequisites;
}
