/**
 * The list of presidential decrees on president.gov.ua — the fallback source of the mobilization term.
 * The list is newest first; every entry links to the decree page (/documents/<number><year>-<id>) and is followed
 * by its date («26 жовтня 2026 року») and title («Про продовження строку проведення загальної мобілізації»).
 * The markup is read loosely: everything between one decree link and the next is that decree's entry.
 */
import { addDays } from '../../common/utils/dates.utils.js';
import type { IsoDate } from '../../shared/interfaces/common.interface.js';
import type { DecreeListItem } from '../../shared/interfaces/document.interface.js';
import {
  DECREE_SEARCH_BEFORE_END_DAYS,
  DECREE_SEARCH_WITHOUT_TERM_DAYS,
  UA_MONTHS_GENITIVE,
} from '../notifications.constants.js';
import { htmlToText } from './decree-parser.utils.js';

const DECREE_LINK = /href\s*=\s*["']((?:https?:\/\/(?:www\.)?president\.gov\.ua)?\/documents\/(\d{3,9})-\d+)["']/gi;
const NUMBER = /№\s*(\d{1,5}\/\d{4})/u;
const UA_DATE = /(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})\s+року/iu;
const EXTENSION_TITLE = /продовження\s+строку\s+проведення\s+загальної\s+мобілізації/iu;

/** «26 жовтня 2026 року» → 2026-10-26. */
export function parseUaDate(text: string): IsoDate | null {
  const m = UA_DATE.exec(text);
  const month = m ? UA_MONTHS_GENITIVE[m[2].toLowerCase()] : undefined;
  if (!m || !month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** The entries of one page of the list, in the order of the page (newest first). */
export function parseDecreeList(html: string, baseUrl: string): DecreeListItem[] {
  const links = [...html.matchAll(DECREE_LINK)];
  const items: DecreeListItem[] = [];
  const seen = new Set<string>();
  links.forEach((link, i) => {
    const url = new URL(link[1], baseUrl).href;
    if (seen.has(url)) return;
    seen.add(url);
    const end = links.slice(i + 1).find((next) => new URL(next[1], baseUrl).href !== url)?.index ?? html.length;
    const text = htmlToText(html.slice(link.index, end)).trim();
    const number = NUMBER.exec(text)?.[1] ?? '';
    if (!number) return;
    items.push({ url, number, date: parseUaDate(text), text });
  });
  return items;
}

/** «Про продовження строку проведення загальної мобілізації». */
export function isMobilizationExtension(item: DecreeListItem): boolean {
  return EXTENSION_TITLE.test(item.text);
}

/** «№ 1061/2026 від 26.10.2026». */
export function decreeLabel(item: DecreeListItem): string {
  const date = item.date ? ` від ${item.date.split('-').reverse().join('.')}` : '';
  return `№ ${item.number}${date}`;
}

/**
 * The window of dates to search: from a while before the known end of the term (the next decree comes out before
 * it), or far enough back when no term is known yet.
 */
export function decreeSearchWindow(until: IsoDate | null, today: IsoDate): { from: IsoDate; to: IsoDate } {
  const from = until
    ? addDays(until, -DECREE_SEARCH_BEFORE_END_DAYS)
    : addDays(today, -DECREE_SEARCH_WITHOUT_TERM_DAYS);
  return { from: from < today ? from : addDays(today, -DECREE_SEARCH_BEFORE_END_DAYS), to: today };
}

/** A page of the list filtered by dates (the site's own date-from / date-to, DD-MM-YYYY). */
export function decreeListUrl(base: string, from: IsoDate, to: IsoDate, page: number): string {
  const ua = (d: IsoDate) => d.split('-').reverse().join('-');
  const url = new URL(base);
  url.searchParams.set('date-from', ua(from));
  url.searchParams.set('date-to', ua(to));
  url.searchParams.set('page', String(page));
  return url.href;
}
