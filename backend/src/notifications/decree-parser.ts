/**
 * Reads the term of general mobilization from the text of Decree No. 65/2022 «Про загальну мобілізацію»
 * (consolidated text on zakon.rada.gov.ua) or from an extension decree. Each extension is written as
 *   «Строк проведення загальної мобілізації продовжено з 2 серпня 2026 року на 90 діб … № 597/2026 від 13.07.2026»
 * or, in the decree itself,
 *   «продовжити з 2 серпня 2026 року строк проведення загальної мобілізації на 90 діб».
 * The latest extension wins: mobilization lasts until start + days.
 */
import { addDays, type IsoDate } from '../common/utils/dates.js';

const MONTHS: Record<string, number> = {
  січня: 1, лютого: 2, березня: 3, квітня: 4, травня: 5, червня: 6,
  липня: 7, серпня: 8, вересня: 9, жовтня: 10, листопада: 11, грудня: 12,
};

export interface MobilizationTerm {
  /** Start of the latest extension. */
  from: IsoDate;
  days: number;
  /** Mobilization lasts until this date. */
  until: IsoDate;
  /** «№ 597/2026 від 13.07.2026», when the text names the decree. */
  decree: string;
}

/** HTML → plain text (tags removed, entities decoded, whitespace collapsed). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

const PATTERN =
  /продовж\S*\s+з\s+(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})\s+року\s+(?:строк\s+проведення\s+загальної\s+мобілізації\s+)?на\s+(\d{1,3})\s+діб([^{}()]{0,160})/giu;

export function parseMobilizationTerm(text: string): MobilizationTerm | null {
  let best: MobilizationTerm | null = null;
  for (const m of text.matchAll(PATTERN)) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    const from = `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const days = Number(m[4]);
    if (!days || days > 365) continue;
    const decreeMatch = /№\s*(\d+\/\d{4})(?:\s+від\s+(\d{2}\.\d{2}\.\d{4}))?/u.exec(m[5] ?? '');
    const decree = decreeMatch ? `№ ${decreeMatch[1]}${decreeMatch[2] ? ` від ${decreeMatch[2]}` : ''}` : '';
    const term = { from, days, until: addDays(from, days), decree };
    if (!best || term.from > best.from) best = term;
  }
  return best;
}
