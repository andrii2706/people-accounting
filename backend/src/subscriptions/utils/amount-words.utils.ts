/**
 * An amount in words for the invoices: 1250.5 → «Одна тисяча двісті п’ятдесят гривень 50 копійок».
 * Гривня and тисяча are feminine (одна, дві), мільйон — masculine (один, два).
 */

const ONES_M = ['', 'один', 'два', 'три', 'чотири', 'п’ять', 'шість', 'сім', 'вісім', 'дев’ять'];
const ONES_F = ['', 'одна', 'дві', 'три', 'чотири', 'п’ять', 'шість', 'сім', 'вісім', 'дев’ять'];
const TEENS = [
  'десять',
  'одинадцять',
  'дванадцять',
  'тринадцять',
  'чотирнадцять',
  'п’ятнадцять',
  'шістнадцять',
  'сімнадцять',
  'вісімнадцять',
  'дев’ятнадцять',
];
const TENS = [
  '',
  '',
  'двадцять',
  'тридцять',
  'сорок',
  'п’ятдесят',
  'шістдесят',
  'сімдесят',
  'вісімдесят',
  'дев’яносто',
];
const HUNDREDS = ['', 'сто', 'двісті', 'триста', 'чотириста', 'п’ятсот', 'шістсот', 'сімсот', 'вісімсот', 'дев’ятсот'];

/** [one, two-four, five+]: 1 гривня, 2 гривні, 5 гривень; 11–14 — five+. */
export function plural(n: number, forms: [string, string, string]): string {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}

function triad(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) words.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) words.push(TENS[t]);
    if (o) words.push((feminine ? ONES_F : ONES_M)[o]);
  }
  return words;
}

const SCALES: { forms: [string, string, string]; feminine: boolean }[] = [
  { forms: ['', '', ''], feminine: true },
  { forms: ['тисяча', 'тисячі', 'тисяч'], feminine: true },
  { forms: ['мільйон', 'мільйони', 'мільйонів'], feminine: false },
  { forms: ['мільярд', 'мільярди', 'мільярдів'], feminine: false },
];

/** A whole number of hryvnias in words (feminine): 21 → «двадцять одна». */
export function hryvniasInWords(n: number): string {
  if (n === 0) return 'нуль';
  const words: string[] = [];
  let scale = 0;
  let rest = Math.floor(n);
  const parts: string[][] = [];
  while (rest > 0 && scale < SCALES.length) {
    const t = rest % 1000;
    if (t) {
      const { forms, feminine } = SCALES[scale];
      parts.unshift([...triad(t, feminine), ...(scale ? [plural(t, forms)] : [])]);
    }
    rest = Math.floor(rest / 1000);
    scale++;
  }
  for (const p of parts) words.push(...p);
  return words.join(' ');
}

export function amountInWords(amount: number): string {
  const cents = Math.round(amount * 100);
  const uah = Math.floor(cents / 100);
  const kop = cents % 100;
  const text = `${hryvniasInWords(uah)} ${plural(uah, ['гривня', 'гривні', 'гривень'])} ${String(kop).padStart(2, '0')} ${plural(kop, ['копійка', 'копійки', 'копійок'])}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 1250.5 → «1 250,50». */
export function money(amount: number): string {
  const [int, frac] = (Math.round(amount * 100) / 100).toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${frac}`;
}
