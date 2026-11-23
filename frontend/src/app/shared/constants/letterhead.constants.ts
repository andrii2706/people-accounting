import type { SelectOption } from '../interfaces/ui.interface';
import type {
  LetterheadAlign,
  LetterheadSettings,
  LetterheadTitle,
} from '../interfaces/letterhead.interface';

/** The same as on the server: Arial, the full name 16 pt in bold across the page, the rest 10 pt. */
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

/** Limits: sizes, points; lengths of the texts. */
export const LETTERHEAD_LIMITS = {
  titleSize: [8, 28],
  textSize: [6, 16],
  customTitle: 300,
  extraLine: 300,
} as const;

export const LETTERHEAD_TITLE_OPTIONS: { value: LetterheadTitle; label: string }[] = [
  { value: 'FULL', label: 'Повна' },
  { value: 'SHORT', label: 'Скорочена' },
  { value: 'CUSTOM', label: 'Своя' },
];

export const LETTERHEAD_ALIGN_OPTIONS: { value: LetterheadAlign; label: string }[] = [
  { value: 'center', label: 'По центру' },
  { value: 'left', label: 'Ліворуч' },
];

/** Sizes offered in the lists, points. */
export const LETTERHEAD_TITLE_SIZES: SelectOption[] = [12, 14, 16, 18, 20, 22, 24].map((n) => ({
  value: String(n),
  label: `${n} пт`,
}));
export const LETTERHEAD_TEXT_SIZES: SelectOption[] = [8, 9, 10, 11, 12].map((n) => ({
  value: String(n),
  label: `${n} пт`,
}));

/** The code of a company (8 digits) or of a person (10, РНОКПП). */
export const LETTERHEAD_CODE_LABELS = { company: 'Код ЄДР', person: 'РНОКПП' } as const;

/** The preview: an A4 sheet 210 mm wide, its margins (as in the letters: 30 mm left, 15 mm right, 20 mm top). */
export const LETTERHEAD_PREVIEW = { widthMm: 210, leftMm: 30, rightMm: 15, topMm: 20 } as const;
