import { LETTERHEAD_CODE_LABELS } from '../constants/letterhead.constants';
import type {
  LetterheadContent,
  LetterheadRequisites,
  LetterheadSettings,
} from '../interfaces/letterhead.interface';

/** The postal index first, then the rest of the address — the same as the server prints it. */
export function letterheadAddress(address: string, postalCode: string): string {
  const code = postalCode.trim() || (/(?:^|\D)(\d{5})(?:\D|$)/.exec(address)?.[1] ?? '');
  const rest = address
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter((x) => x && x !== code)
    .join(', ');
  return [code, rest].filter(Boolean).join(', ');
}

/** «Код ЄДР 12345678»; ten digits — the code of a person. */
export function letterheadCode(edrpou: string): string {
  const code = edrpou.trim();
  if (!code) return '';
  return `${code.length === 10 ? LETTERHEAD_CODE_LABELS.person : LETTERHEAD_CODE_LABELS.company} ${code}`;
}

/** The lines of the letterhead from the requisites — what a letter will have at the top. */
export function letterheadContent(
  org: LetterheadRequisites,
  s: LetterheadSettings,
): LetterheadContent {
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

/** Rows under the name: [left, right] — the code on the right of the first row. */
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

/** The requisites that are not filled in — the letterhead leaves them out, the page says so. */
export function missingRequisites(org: LetterheadRequisites, s: LetterheadSettings): string[] {
  return [
    s.showAddress && !org.address.trim() ? 'адреса' : '',
    s.showCode && !org.edrpou.trim() ? 'код ЄДР' : '',
    s.showPhone && !org.phone.trim() ? 'телефон' : '',
    s.showEmail && !org.email.trim() ? 'email' : '',
  ].filter(Boolean);
}
