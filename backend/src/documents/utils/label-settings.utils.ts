import type { EnvelopeLabel, LabelParty } from '../../shared/interfaces/document.interface.js';
import type { FieldError } from '../../shared/interfaces/common.interface.js';
import type { LabelSettings } from '../../shared/interfaces/label-settings.interface.js';
import {
  A4_MM,
  DEFAULT_LABEL_SETTINGS,
  ENVELOPE_SIZES,
  LABEL_LINES,
  LABEL_PARTIES,
  LABEL_SETTING_FIELDS,
  LEGACY_LABEL_LINES,
  PAGE_TAIL_MM,
  PRINT_EDGE_MM,
  LABEL_FIT_RESERVE,
  LABEL_MIN_SCALE,
  PT_PER_MM,
} from '../label-settings.constants.js';

/** Every item of `all` exactly once, in any order. */
export const isPermutation = (value: unknown, all: readonly string[]): boolean =>
  Array.isArray(value) &&
  value.length === all.length &&
  new Set(value).size === all.length &&
  value.every((v) => all.includes(v as string));

/** Saved settings with the defaults for keys added later (or none saved — the defaults). */
export function withLabelDefaults(saved: Partial<LabelSettings> | null | undefined): LabelSettings {
  const out = { ...DEFAULT_LABEL_SETTINGS };
  for (const key of LABEL_SETTING_FIELDS) {
    const value = saved?.[key];
    if (value !== undefined && value !== null) (out as Record<string, unknown>)[key] = value;
  }
  const legacy = out.lineOrder.join() === LEGACY_LABEL_LINES.join();
  if (legacy || !isPermutation(out.lineOrder, LABEL_LINES)) out.lineOrder = [...LABEL_LINES];
  if (!isPermutation(out.partyOrder, LABEL_PARTIES)) out.partyOrder = [...LABEL_PARTIES];
  return out;
}

/**
 * The address without its postal index — the index is printed once, on its own line (or in the cells).
 * «79000, м. Львів, вул. Зразкова, 1» → «м. Львів, вул. Зразкова, 1».
 */
export function stripPostalCode(address: string, code: string): string {
  const text = address.trim();
  if (!code) return text;
  return text
    .replace(new RegExp(`(^|[\\s,;])${code}(?=$|[\\s,;])`, 'g'), '$1')
    .replace(/\s*([,;])(\s*[,;])+/g, '$1')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

/** Millimetres → twips of Word (1/1440 inch). */
export const twips = (mm: number) => Math.round((mm * 1440) / 25.4);

/** Width of a row of labels on A4, mm. */
export const sheetRowWidth = (s: LabelSettings) => s.columns * s.labelWidthMm + (s.columns - 1) * s.gapMm;

/** Rows of labels that fit on one A4 page. */
export function rowsPerPage(s: LabelSettings): number {
  const usable = A4_MM.heightMm - s.marginTopMm - PRINT_EDGE_MM - PAGE_TAIL_MM;
  return Math.max(1, Math.floor((usable + s.gapMm) / (s.labelHeightMm + s.gapMm)));
}

export const labelsPerPage = (s: LabelSettings) => (s.mode === 'ENVELOPE' ? 1 : s.columns * rowsPerPage(s));

/**
 * What does not fit on the paper: the labels of a row wider than A4, the blocks beyond the envelope,
 * the recipient above or to the left of the sender. Only the fields of the chosen mode are checked.
 */
export function labelSettingsProblems(s: LabelSettings): FieldError[] {
  const out: FieldError[] = [];
  if (s.mode === 'SHEET') {
    const room = A4_MM.widthMm - PRINT_EDGE_MM;
    if (s.marginLeftMm + sheetRowWidth(s) > room) {
      out.push({
        field: 'labelWidthMm',
        message: `Ряд наклейок не вміщується по ширині A4: відступ + наклейки = ${s.marginLeftMm + sheetRowWidth(s)} мм, доступно ${room} мм`,
      });
    }
    const height = A4_MM.heightMm - PRINT_EDGE_MM - PAGE_TAIL_MM;
    if (s.marginTopMm + s.labelHeightMm > height) {
      out.push({
        field: 'labelHeightMm',
        message: `Наклейка не вміщується по висоті A4: відступ + висота = ${s.marginTopMm + s.labelHeightMm} мм, доступно ${height} мм`,
      });
    }
    if (2 * s.paddingMm >= s.labelHeightMm) {
      out.push({ field: 'paddingMm', message: 'Поле всередині більше за саму наклейку' });
    }
    return out;
  }

  const env = ENVELOPE_SIZES[s.envelope];
  const right = env.widthMm - 3;
  if (s.senderXMm + s.senderWidthMm > right) {
    out.push({
      field: 'senderWidthMm',
      message: `Відправник виходить за правий край конверта (${s.senderXMm + s.senderWidthMm} з ${right} мм)`,
    });
  }
  if (s.recipientXMm + s.recipientWidthMm > right) {
    out.push({
      field: 'recipientWidthMm',
      message: `Отримувач виходить за правий край конверта (${s.recipientXMm + s.recipientWidthMm} з ${right} мм)`,
    });
  }
  if (s.recipientXMm < s.senderXMm) {
    out.push({ field: 'recipientXMm', message: 'Отримувач має бути не лівіше за відправника' });
  }
  if (s.recipientYMm < s.senderYMm + 15) {
    out.push({ field: 'recipientYMm', message: 'Отримувач має бути щонайменше на 15 мм нижче за відправника' });
  }
  if (s.recipientYMm > env.heightMm - 25) {
    out.push({
      field: 'recipientYMm',
      message: `Під отримувачем замало місця: конверт ${env.heightMm} мм заввишки, потрібно хоча б 25 мм`,
    });
  }
  return out;
}

/** «Індекс: 79000» or just «79000»; a blank to write by hand when the code is unknown. */
export const postalLine = (code: string, prefix: boolean) => {
  const value = code || '________';
  return prefix ? `Індекс: ${value}` : value;
};

/**
 * How much the text of a label has to shrink to fit its sticker: a long full name of a legal entity and a
 * long address would otherwise be cut off at the bottom — and the index or the phone with them. An estimate
 * (an average letter is half of the font size wide), the same in the .docx and in the browser; never below
 * LABEL_MIN_SCALE. An envelope has room — 1.
 */
export function labelScale(label: EnvelopeLabel, s: LabelSettings): number {
  if (s.mode !== 'SHEET') return 1;
  const pad = s.paddingMm * PT_PER_MM;
  // a reserve for what the estimate does not see (the spacing of the paragraphs, the cells of the index)
  const height = (s.labelHeightMm * PT_PER_MM - 2 * pad) * LABEL_FIT_RESERVE;
  const side = s.layout === 'SIDE_BY_SIDE';
  const width = (side ? s.labelWidthMm / 2 : s.labelWidthMm) * PT_PER_MM - 2 * pad;
  for (let k = 1; k > LABEL_MIN_SCALE; k = Math.round((k - 0.05) * 100) / 100) {
    const t = scaledLabelSettings(s, k);
    const a = partyHeight(label.sender, t, width);
    const b = partyHeight(label.recipient, t, width);
    if ((side ? Math.max(a, b) : a + b + 6) <= height) return k;
  }
  return LABEL_MIN_SCALE;
}

/** The settings with the font sizes of one label scaled (to half a point). */
export function scaledLabelSettings(s: LabelSettings, k: number): LabelSettings {
  if (k >= 1) return s;
  const r = (size: number) => Math.max(6, Math.round(size * k * 2) / 2);
  return {
    ...s,
    titleSize: r(s.titleSize),
    nameSize: r(s.nameSize),
    addressSize: r(s.addressSize),
    postalSize: r(s.postalSize),
    phoneSize: r(s.phoneSize),
  };
}

/** Lines a text takes in a column `width` pt wide (words wrapped as a whole). */
function wrappedLines(text: string, size: number, width: number, bold: boolean): number {
  const perLine = Math.max(1, Math.floor(width / (size * (bold ? 0.55 : 0.5))));
  let lines = 1;
  let used = 0;
  for (const word of (text || '_'.repeat(16)).split(/\s+/)) {
    const len = word.length + (used ? 1 : 0);
    if (used && used + len > perLine) {
      lines += Math.ceil(word.length / perLine);
      used = word.length % perLine;
    } else {
      used += len;
    }
  }
  return lines;
}

/** The height of one party in points: the title, the name, the address lines, the index, the phone. */
function partyHeight(party: LabelParty, s: LabelSettings, width: number): number {
  const line = (size: number) => size * 1.25;
  const address = party.addressLines?.length ? party.addressLines : [party.address];
  return (
    (s.showTitles ? line(s.titleSize) + 3 : 0) +
    wrappedLines(party.name, s.nameSize, width, s.nameBold) * line(s.nameSize) +
    address.reduce((h, a) => h + wrappedLines(a, s.addressSize, width, false) * line(s.addressSize), 0) +
    (s.postalStyle === 'BOXES' ? s.postalSize * 1.45 + 10 : line(s.postalSize)) +
    (s.showPhone ? line(s.phoneSize) : 0)
  );
}
