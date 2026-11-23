import { LABEL_FONTS } from '../label-settings.constants.js';
import {
  DEFAULT_LETTERHEAD_SETTINGS,
  LETTERHEAD_ALIGNS,
  LETTERHEAD_CODE_LABELS,
  LETTERHEAD_LIMITS,
  LETTERHEAD_TITLES,
} from '../letterhead.constants.js';
import type {
  LetterheadContent,
  LetterheadRequisites,
  LetterheadSettings,
} from '../../shared/interfaces/letterhead.interface.js';
import { lineHeight, textLines } from './page-estimate.utils.js';

const clamp = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const oneOf = <T>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Saved settings (or none, or an older set) → a full and valid set. */
export function withLetterheadDefaults(saved: Partial<LetterheadSettings> | null | undefined): LetterheadSettings {
  const d = DEFAULT_LETTERHEAD_SETTINGS;
  const s = saved ?? {};
  return {
    enabled: bool(s.enabled, d.enabled),
    font: oneOf(s.font, LABEL_FONTS, d.font),
    titleSize: clamp(s.titleSize, LETTERHEAD_LIMITS.titleSize, d.titleSize),
    textSize: clamp(s.textSize, LETTERHEAD_LIMITS.textSize, d.textSize),
    titleBold: bool(s.titleBold, d.titleBold),
    titleAlign: oneOf(s.titleAlign, LETTERHEAD_ALIGNS, d.titleAlign),
    title: oneOf(s.title, LETTERHEAD_TITLES, d.title),
    customTitle: str(s.customTitle, LETTERHEAD_LIMITS.customTitle),
    showAddress: bool(s.showAddress, d.showAddress),
    showCode: bool(s.showCode, d.showCode),
    showPhone: bool(s.showPhone, d.showPhone),
    showEmail: bool(s.showEmail, d.showEmail),
    extraLine: str(s.extraLine, LETTERHEAD_LIMITS.extraLine),
    rule: bool(s.rule, d.rule),
  };
}

/** The postal index first, then the rest of the address: «79033, м. Львів, вул. Шевченка, 27». */
export function letterheadAddress(address: string, postalCode: string): string {
  const code = postalCode.trim() || (/(?:^|\D)(\d{5})(?:\D|$)/.exec(address)?.[1] ?? '');
  const rest = address
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter((x) => x && x !== code)
    .join(', ');
  return [code, rest].filter(Boolean).join(', ');
}

/** «Код ЄДР 46034800»; ten digits — the code of a person (a sole proprietor). */
export function letterheadCode(edrpou: string): string {
  const code = edrpou.trim();
  if (!code) return '';
  return `${code.length === 10 ? LETTERHEAD_CODE_LABELS.person : LETTERHEAD_CODE_LABELS.company} ${code}`;
}

/**
 * The lines of the letterhead from the requisites of the legal entity — so a changed address or phone is on the
 * next letter by itself. A requisite that is empty is left out (no blank for the pen on a letterhead).
 */
export function letterheadContent(org: LetterheadRequisites, s: LetterheadSettings): LetterheadContent {
  const title =
    (s.title === 'CUSTOM' && s.customTitle.trim()) ||
    (s.title === 'SHORT' && org.shortName.trim()) ||
    org.fullName.trim() ||
    org.shortName.trim();
  const contacts = [
    s.showPhone && org.phone.trim() ? `Тел. ${org.phone.trim()}` : '',
    s.showEmail && org.email.trim() ? `E-mail: ${org.email.trim()}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return {
    title,
    address: s.showAddress ? letterheadAddress(org.address, org.postalCode) : '',
    code: s.showCode ? letterheadCode(org.edrpou) : '',
    contacts,
    extra: s.extraLine.trim(),
  };
}

/** Rows of the table of the letterhead under the name: [left, right] (the code on the right of the first row). */
export function letterheadRows(c: LetterheadContent): [string, string][] {
  const left = [c.address, c.contacts].filter(Boolean);
  const rows: [string, string][] = left.length
    ? left.map((t, i) => [t, i === 0 ? c.code : ''])
    : c.code
      ? [['', c.code]]
      : [];
  if (c.extra) rows.push([c.extra, '']);
  return rows;
}

/** The width of the code column, twips: the code fits on one line. */
export const LETTERHEAD_CODE_WIDTH = 2600;

/** The height of the letterhead with the empty line under it (twips) — for the count of the sheets of a letter. */
export function letterheadHeight(c: LetterheadContent, s: LetterheadSettings, width: number): number {
  const title = textLines(c.title, s.titleSize, width) * lineHeight(s.titleSize);
  const rows = letterheadRows(c).reduce(
    (sum, [left]) => sum + textLines(left, s.textSize, width - LETTERHEAD_CODE_WIDTH) * lineHeight(s.textSize),
    0,
  );
  return title + rows + lineHeight(12);
}
