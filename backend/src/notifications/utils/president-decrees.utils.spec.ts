import { describe, expect, it } from 'vitest';
import { parseMobilizationTerm, htmlToText } from './decree-parser.utils.js';
import {
  decreeLabel,
  decreeListUrl,
  decreeSearchWindow,
  isMobilizationExtension,
  parseDecreeList,
  parseUaDate,
} from './president-decrees.utils.js';

const BASE = 'https://www.president.gov.ua/documents/decrees';

/** A page of the decree list as president.gov.ua shows it: a heading with the link, then the date and the title. */
const LIST_PAGE = `
  <div class="item">
    <h3><a href="https://www.president.gov.ua/documents/10652026-62241">УКАЗ ПРЕЗИДЕНТА УКРАЇНИ №1065/2026</a></h3>
    <p class="date">27 жовтня 2026 року</p>
    <p>Про відзначення державними нагородами України</p>
  </div>
  <div class="item">
    <h3><a href="/documents/10612026-62225">УКАЗ ПРЕЗИДЕНТА УКРАЇНИ №1061/2026</a></h3>
    <p class="date">26 жовтня 2026 року</p>
    <p>Про продовження строку проведення загальної мобілізації</p>
  </div>
  <div class="item">
    <h3><a href="/documents/10602026-62221">УКАЗ ПРЕЗИДЕНТА УКРАЇНИ №1060/2026</a></h3>
    <p class="date">26 жовтня 2026 року</p>
    <p>Про продовження строку дії воєнного стану в Україні</p>
  </div>`;

/** The page of the decree itself. */
const DECREE_PAGE = `<h1>УКАЗ ПРЕЗИДЕНТА УКРАЇНИ №1061/2026</h1>
  <p>Про продовження строку проведення загальної мобілізації</p>
  <p>1. Внести до статті 3 Указу Президента України від 24 лютого 2022 року № 65 «Про загальну мобілізацію»
  … зміну, продовживши з 31 жовтня 2026 року строк проведення загальної мобілізації на 90 діб.</p>
  <p>2. Цей Указ набирає чинності одночасно з набранням чинності Законом України …</p>
  <p>26 жовтня 2026 року</p>`;

describe('укази на president.gov.ua — запасне джерело строку мобілізації', () => {
  it('розбирає список: номер, дата, назва, абсолютне посилання', () => {
    const items = parseDecreeList(LIST_PAGE, BASE);
    expect(items.map((i) => i.number)).toEqual(['1065/2026', '1061/2026', '1060/2026']);
    expect(items[1]).toMatchObject({
      url: 'https://www.president.gov.ua/documents/10612026-62225',
      date: '2026-10-26',
    });
  });

  it('знаходить указ про продовження мобілізації, а не воєнного стану', () => {
    const found = parseDecreeList(LIST_PAGE, BASE).filter(isMobilizationExtension);
    expect(found.map((i) => i.number)).toEqual(['1061/2026']);
    expect(decreeLabel(found[0])).toBe('№ 1061/2026 від 26.10.2026');
  });

  it('з тексту указу — строк до 29.01.2027', () => {
    expect(parseMobilizationTerm(htmlToText(DECREE_PAGE))).toMatchObject({
      from: '2026-10-31',
      days: 90,
      until: '2027-01-29',
    });
  });

  it('дата українською', () => {
    expect(parseUaDate('26 жовтня 2026 року')).toBe('2026-10-26');
    expect(parseUaDate('без дати')).toBeNull();
  });

  it('вікно пошуку: від 60 днів до кінця строку; без строку — 150 днів назад', () => {
    expect(decreeSearchWindow('2026-10-31', '2026-11-17')).toEqual({ from: '2026-09-01', to: '2026-11-17' });
    expect(decreeSearchWindow('2027-01-29', '2026-11-17')).toEqual({ from: '2026-09-18', to: '2026-11-17' });
    expect(decreeSearchWindow(null, '2026-11-17')).toEqual({ from: '2026-06-20', to: '2026-11-17' });
  });

  it('посилання на сторінку списку з фільтром дат сайту', () => {
    expect(decreeListUrl(BASE, '2026-09-01', '2026-11-17', 2)).toBe(
      `${BASE}?date-from=01-09-2026&date-to=17-11-2026&page=2`,
    );
  });
});
