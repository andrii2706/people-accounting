import type {
  LetterheadAlign,
  LetterheadSettings,
  LetterheadTitle,
} from '../shared/interfaces/letterhead.interface.js';

export const LETTERHEAD_TITLES: LetterheadTitle[] = ['FULL', 'SHORT', 'CUSTOM'];
export const LETTERHEAD_ALIGNS: LetterheadAlign[] = ['center', 'left'];

/** As the letterheads of most companies: Arial, the full name 16 pt in bold across the page, the rest 10 pt. */
export const DEFAULT_LETTERHEAD_SETTINGS: LetterheadSettings = {
  enabled: true,
  font: 'Arial',
  titleSize: 16,
  textSize: 10,
  titleBold: true,
  titleAlign: 'center',
  title: 'FULL',
  customTitle: '',
  showAddress: true,
  showCode: true,
  showPhone: true,
  showEmail: true,
  extraLine: '',
  rule: true,
};

/** Limits: sizes of the text, points; the lengths of the texts. */
export const LETTERHEAD_LIMITS = {
  titleSize: [8, 28],
  textSize: [6, 16],
  customTitle: 300,
  extraLine: 300,
} as const;

/** All keys — compared for the journal. */
export const LETTERHEAD_SETTING_FIELDS = Object.keys(DEFAULT_LETTERHEAD_SETTINGS) as (keyof LetterheadSettings)[];

/** Journal of a legal entity: the keys of the letterhead are written as «letterhead:<key>». */
export const LETTERHEAD_JOURNAL_PREFIX = 'letterhead:';

/** Readable values for the journal. */
export const LETTERHEAD_VALUE_TEXT: Record<string, string> = {
  FULL: 'повна назва',
  SHORT: 'скорочена назва',
  CUSTOM: 'своя назва',
  center: 'по центру',
  left: 'ліворуч',
  true: 'так',
  false: 'ні',
};

/** The code of a company (8 digits) or of a person (10, РНОКПП). */
export const LETTERHEAD_CODE_LABELS = { company: 'Код ЄДР', person: 'РНОКПП' } as const;
