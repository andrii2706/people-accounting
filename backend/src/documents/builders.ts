/**
 * Document builders. Texts and structure follow the employee card (rows 30–100, 116–147)
 * and sheets G1…G4R, OCL of the file new_military_list v8.6.
 */
import { BorderStyle, HeightRule, type Paragraph, Table, TableCell, TableLayoutType, TableRow, WidthType } from 'docx';
import { formatUa, formatUaLong, type IsoDate } from '../common/utils/dates.js';
import type { Tck } from '../dictionaries/tck.entity.js';
import { CHANGE_TYPE_LABELS, type ChangeType, LIST_GROUP_TITLES, type ListGroup } from '../military/dictionaries.js';
import {
  LIST_TITLES,
  LIST_WIDTHS,
} from '../military/personal-list.js';
import type { Organization } from '../organization/organization.entity.js';
import type { ResponsiblePerson } from '../organization/responsible-person.entity.js';
import {
  A4,
  type CellSpec,
  CONTENT_WIDTH,
  empty,
  hint,
  p,
  pageBreak,
  render,
  run,
  section,
  signature,
  table,
  twoColumns,
} from './docx-kit.js';
import { inGenitive } from './name-declension.js';
import type { NoticeSnapshot } from './notice-snapshot.js';

const blank = (v: string | null | undefined, filler = '________________') => (v && v.trim() ? v : filler);

const tckGenitive = (tck: Tck | null | undefined) => tck?.nameGenitive || tck?.name || '________________';

function orgHeader(org: Organization): Paragraph[] {
  return [
    p(blank(org.shortName || org.fullName), { bold: true }),
    p(org.address),
    org.phone ? p(`тел. ${org.phone}`) : p(''),
    p(`Код ЄДР - ${blank(org.edrpou, '________')}`),
  ];
}

function executor(person: ResponsiblePerson | null): Paragraph[] {
  if (!person) return [];
  return [...empty(2), p(`Виконавець: ${person.fullName}${person.phone ? `, тел. ${person.phone}` : ''}`, { size: 9 })];
}

// ================================================================ Change notices (Annex 4) with a cover letter

export interface NoticeItem extends NoticeSnapshot {
  sequence: number;
  changeType: ChangeType;
}

export interface ChangeNoticeInput {
  letter: { number: string; date: IsoDate };
  /** Addressee of the cover letter. */
  tck: Tck | null;
  notices: NoticeItem[];
  org: Organization;
  responsible: ResponsiblePerson | null;
}

export function noticeNumber(letterNumber: string, sequence: number, total: number) {
  return total > 1 ? `${letterNumber}/${sequence}` : letterNumber;
}

const snapshotName = (n: NoticeSnapshot) => [n.lastName, n.firstName, n.middleName].filter(Boolean).join(' ');

function noticePage(n: NoticeItem, ctx: { letter: ChangeNoticeInput['letter']; org: Organization; total: number; tckGenitiveName: string }): (Paragraph | Table)[] {
  const w = CONTENT_WIDTH.portrait;
  const row = (label: string, value: string): (string | CellSpec)[] => [
    { text: label, size: 11 },
    { text: value, size: 11, bold: true },
  ];
  return [
    twoColumns([p('')], [p('Додаток 4', { size: 10 }), p('до Порядку', { size: 10 })], [w - 2600, 2600]),
    ...empty(1),
    twoColumns(
      [p(`вих. № ${noticeNumber(ctx.letter.number, n.sequence, ctx.total)}`), p(`від ${formatUa(ctx.letter.date)} р.`)],
      [p(ctx.tckGenitiveName.replace(/^./, (c) => c.toUpperCase()), { underline: true }),
        hint('(найменування районного (міського) територіального центру комплектування та соціальної підтримки, органу СБУ, підрозділу Служби зовнішньої розвідки)')],
      [w / 2, w / 2],
    ),
    ...empty(1),
    p('ПОВІДОМЛЕННЯ', { bold: true, align: 'center', size: 14 }),
    p('про зміну облікових даних', { bold: true, align: 'center', size: 14, spacingAfter: 200 }),
    table([], [
      row('1. Прізвище, власне ім’я та по батькові (за наявності)', snapshotName(n)),
      row('2. Реєстраційний номер облікового запису Єдиного державного реєстру призовників, військовозобов’язаних та резервістів', blank(n.registryNumber)),
      row('3. Військово-обліковий документ', blank(n.militaryDoc)),
      row('4. Номер військово-облікової спеціальності', blank(n.vos)),
      row('5. Військове звання', blank(n.rank, n.conscript ? 'призовник' : '________________')),
      row('6. Дата народження', formatUa(n.birthDate)),
      row('7. Зміна облікових даних', n.change),
      row('8. Підстава для зміни облікових даних (найменування документа, номер та дата видачі)', blank(n.basis)),
      row('9. Перебування на військовому обліку', blank(n.tckName)),
      row('10. Адреса задекларованого/зареєстрованого місця проживання', blank(n.registeredAddress)),
      row('11. Адреса фактичного місця проживання', blank(n.actualAddress)),
    ], [Math.round(w * 0.45), Math.round(w * 0.55)], { borders: false }),
    ...empty(2),
    signature(`${ctx.org.headPosition} ${ctx.org.shortName}`.trim(), ctx.org.headName, [Math.round(w * 0.45), Math.round(w * 0.22), Math.round(w * 0.33)]),
    hint('(найменування посади керівника державного органу, органу місцевого самоврядування, підприємства, установи, організації)', 'left'),
  ];
}

/** A single notice (Annex 4) without the cover letter — e.g. to re-print it from the employee card. */
export async function buildSingleNotice(input: Omit<ChangeNoticeInput, 'notices'> & { notice: NoticeItem; total: number }): Promise<Buffer> {
  const page = noticePage(input.notice, { letter: input.letter, org: input.org, total: input.total, tckGenitiveName: tckGenitive(input.tck) });
  return render([section(page)], `Повідомлення ${noticeNumber(input.letter.number, input.notice.sequence, input.total)}`);
}

/** Cover letter + notices (one page per change) + inventory form 107. Supports several employees in one letter. */
export async function buildChangeNotice(input: ChangeNoticeInput): Promise<Buffer> {
  const { org, letter, notices, responsible, tck } = input;
  const w = CONTENT_WIDTH.portrait;
  const total = notices.length;

  // distinct employees, in the order they appear in the letter
  const people = [...new Map(notices.map((n) => [`${snapshotName(n)}|${n.birthDate}`, n])).values()];
  const single = people.length === 1;
  const attachments = notices.map(
    (n) => `${n.sequence}. Повідомлення про зміну облікових даних від ${formatUa(letter.date)} р. № ${noticeNumber(letter.number, n.sequence, total)} (${CHANGE_TYPE_LABELS[n.changeType]}${single ? '' : `, ${snapshotName(n)}`}) на 1 арк.`,
  );

  let body: Paragraph[];
  if (single) {
    const n = people[0];
    const declined = await inGenitive(n);
    const [family, given, patronymic] = declined.split(' ');
    const who = n.gender === 'F' ? 'працівниці' : 'працівника';
    const which = n.gender === 'F' ? 'яка' : 'який';
    body = [
      p(`Щодо повідомлення про зміну облікових даних ${who}`, { bold: true, italics: true }),
      ...empty(1),
      p(
        `У відповідності до п. 34 Порядку організації та ведення військового обліку призовників, військовозобов’язаних та резервістів, ` +
        `затвердженого постановою Кабінету Міністрів України від 30 грудня 2022 р. № 1487, надсилаємо повідомлення про зміну облікових даних ` +
        `${who} ${org.shortName} ${[given, patronymic].filter(Boolean).join(' ')} ${(family ?? n.lastName).toUpperCase()}, ` +
        `дата народження - ${formatUa(n.birthDate)} р., ${which} перебуває на обліку в ${blank(n.tckName)}.`,
        { align: 'justify', indent: 567 },
      ),
    ];
  } else {
    body = [
      p('Щодо повідомлення про зміну облікових даних працівників', { bold: true, italics: true }),
      ...empty(1),
      p(
        `У відповідності до п. 34 Порядку організації та ведення військового обліку призовників, військовозобов’язаних та резервістів, ` +
        `затвердженого постановою Кабінету Міністрів України від 30 грудня 2022 р. № 1487, надсилаємо повідомлення про зміну облікових даних ` +
        `працівників ${org.shortName}:`,
        { align: 'justify', indent: 567 },
      ),
      ...people.map((n, i) =>
        p(
          `${i + 1}. ${n.lastName.toUpperCase()} ${[n.firstName, n.middleName].filter(Boolean).join(' ')}, дата народження - ${formatUa(n.birthDate)} р., ` +
          `перебуває на обліку в ${blank(n.tckName)}.`,
          { align: 'justify', indent: 567 },
        ),
      ),
    ];
  }

  const cover: (Paragraph | Table)[] = [
    twoColumns(orgHeader(org), [p(`Керівнику ${tckGenitive(tck)}`, { bold: true }), p(tck?.address ?? '')], [w / 2, w / 2]),
    ...empty(1),
    p(`Вих. № ${letter.number}`),
    p(`від ${formatUa(letter.date)} р.`),
    ...empty(1),
    ...body,
    ...empty(1),
    p(total === 1 ? 'Додаток:' : 'Додатки:', { bold: true }),
    ...attachments.map((a) => p(a, { indent: 567 })),
    ...empty(2),
    signature(org.headPosition, org.headName, [Math.round(w * 0.45), Math.round(w * 0.22), Math.round(w * 0.33)]),
    ...executor(responsible),
  ];

  const ctx = { letter, org, total, tckGenitiveName: tckGenitive(tck) };
  const pages = notices.flatMap((n) => [pageBreak(), ...noticePage(n, ctx)]);
  const inventory = inventoryPage({
    org,
    tck,
    items: [`Лист щодо повідомлення про зміну облікових даних ${single ? 'працівника' : 'працівників'} від ${formatUa(letter.date)} року № ${letter.number} з додатками (аркушів - ${1 + total})`],
  });

  return render([section([...cover, ...pages, pageBreak(), ...inventory])], `Повідомлення ${letter.number}`);
}

// ================================================================ Inventory of contents, form 107

function inventoryPage(input: { org: Organization; tck: Tck | null | undefined; items: string[] }): (Paragraph | Table)[] {
  const w = CONTENT_WIDTH.portrait;
  return [
    p('ф. 107', { align: 'right' }),
    p('______________________________', { align: 'center' }),
    hint('(найменування об’єкта поштового зв’язку)'),
    ...empty(1),
    p('ОПИС', { bold: true, align: 'center', size: 14 }),
    p([run('вкладення у '), run('цінний лист', { underline: true })], { align: 'center' }),
    hint('(найменування поштового відправлення)'),
    ...empty(1),
    p([run('На ім’я '), run(input.tck?.name ?? '______________________________', { underline: true })]),
    hint('(прізвище одержувача або найменування підприємства)'),
    p([run('Куди '), run(input.tck?.address || '______________________________', { underline: true })]),
    hint('(докладна адреса, поштовий індекс)'),
    ...empty(1),
    table(
      [['№ п/п', 'Найменування предметів', 'Кількість предметів', 'Оголошена цінність (грн)']],
      [
        ...input.items.map((item, i) => [{ text: String(i + 1), align: 'center' as const }, item, { text: '1', align: 'center' as const }, '']),
        [{ text: 'Загальний підсумок предметів і оголошеної цінності', colSpan: 2, bold: true }, { text: String(input.items.length), align: 'center' as const }, ''],
      ],
      [Math.round(w * 0.08), Math.round(w * 0.6), Math.round(w * 0.14), Math.round(w * 0.18)],
      { size: 11, headerSize: 10 },
    ),
    ...empty(2),
    p('Відправник ______________________'),
    hint('(підпис)', 'left'),
    ...empty(1),
    p('Перевірив: _______________________________________________'),
    hint('(посада, підпис працівника зв’язку)'),
    ...empty(1),
    p('Відбиток календарного штемпеля місця приймання', { size: 10 }),
    ...empty(2),
    twoColumns(
      [p('Відправник:', { bold: true }), p(input.org.shortName || input.org.fullName), p(input.org.address)],
      [p('Отримувач:', { bold: true }), p(input.tck?.name ?? ''), p(input.tck?.address ?? '')],
      [w / 2, w / 2],
    ),
  ];
}

// ================================================================ Personal military registration lists (Annex 5, ed. 2025)

export interface ListsInput {
  date: IsoDate;
  extract: boolean;
  /** Lists by group (sheets GN1…GN4R); every row has 18 cells (see military/personal-list.ts). */
  groups: { group: ListGroup; rows: string[][] }[];
  org: Organization;
  letter?: { number: string; date: IsoDate } | null;
}

/** Page margins of sheets GN* (landscape, 0.7" left/right, 0.75" top/bottom). */
const LIST_MARGINS = { top: 1080, bottom: 1080, left: 1008, right: 1008 };

/**
 * Personal military registration lists laid out like sheets GN1…GN4R of the Excel file:
 * a separate list per group on its own landscape page(s), one row per record, columns 1–18.
 */
export async function buildLists(input: ListsInput): Promise<Buffer> {
  const contentWidth = A4.height - LIST_MARGINS.left - LIST_MARGINS.right;
  const total = LIST_WIDTHS.reduce((a, b) => a + b, 0);
  const widths = LIST_WIDTHS.map((w) => Math.floor((contentWidth * w) / total));
  const size = 8;
  const header = [
    LIST_TITLES.map((text) => ({ text, size: 7, align: 'center' as const })),
    LIST_TITLES.map((_, i) => ({ text: String(i + 1), align: 'center' as const })),
  ];
  const sign = [Math.round(contentWidth * 0.3), Math.round(contentWidth * 0.2), Math.round(contentWidth * 0.3)] as [number, number, number];
  const orgText = input.org.nameLocative || input.org.fullName;

  const groupSection = (group: ListGroup | null, rows: string[][]) => {
    const body = rows.length
      ? rows.map((row) => row.map((text, i) => ({ text, size, align: i === 0 || i === 4 ? ('center' as const) : undefined })))
      : [[{ text: 'Особи відсутні', colSpan: LIST_TITLES.length, align: 'center' as const, size }]];
    const whom = group ? LIST_GROUP_TITLES[group].replace(/,$/, '') : 'призовників, військовозобов’язаних та резервістів';
    return section(
      [
        p(`Вихідний номер   ${input.letter?.number ?? '__________'}`, { size: 10 }),
        p(`Дата   ${input.letter ? `${formatUa(input.letter.date)} р.` : '__________'}`, { size: 10 }),
        ...empty(1),
        p(input.extract ? 'ВИТЯГ ІЗ СПИСКІВ' : 'СПИСКИ', { bold: true, align: 'center' }),
        p(`персонального військового обліку ${whom}, які працюють в ${blank(orgText)}`, { align: 'center' }),
        p(`станом на ${formatUa(input.date)} року`, { align: 'center', spacingAfter: 160 }),
        table(header, body, widths, { size, headerSize: 7 }),
        ...empty(2),
        signature(input.org.headPosition, input.org.headName, sign),
      ],
      true,
      LIST_MARGINS,
    );
  };

  const groups = input.groups.filter((g) => g.rows.length);
  return render(
    groups.length ? groups.map((g) => groupSection(g.group, g.rows)) : [groupSection(null, [])],
    input.extract ? 'Витяг зі списків' : 'Списки персонального військового обліку',
  );
}

// ================================================================ Operational registration report (Annex 12)

export interface OperationalRowData {
  code: string;
  title: string;
  total: number;
  mobilizationOrders: number;
  reserved: number;
  other: number;
  hiredSince2020: number;
  dismissedSince2020: number;
}

export interface OperationalInput {
  date: IsoDate;
  rows: OperationalRowData[];
  org: Organization;
  responsible: ResponsiblePerson | null;
  letter?: { number: string; date: IsoDate } | null;
}

export async function buildOperationalReport(input: OperationalInput): Promise<Buffer> {
  const w = CONTENT_WIDTH.landscape;
  const widths = [0.07, 0.29, 0.08, 0.11, 0.1, 0.13, 0.11, 0.11].map((x) => Math.floor(w * x));
  const num = (n: number) => ({ text: n ? String(n) : '-', align: 'center' as const });

  return render([
    section([
      twoColumns(
        [p(`Вихідний № ${input.letter?.number ?? '__________'}`), p(`Дата ${input.letter ? formatUaLong(input.letter.date) + ' року' : '__________'}`)],
        [p('Додаток 12', { align: 'right', size: 10 }), p('до Порядку', { align: 'right', size: 10 })],
        [w / 2, w / 2],
      ),
      ...empty(1),
      p('ВІДОМІСТЬ', { bold: true, align: 'center', size: 14 }),
      p('оперативного обліку призовників, військовозобов’язаних та резервістів у', { bold: true, align: 'center' }),
      p(blank(input.org.nameLocative || input.org.fullName), { align: 'center', underline: true }),
      hint('(назва державного органу, органу місцевого самоврядування, підприємства, установи, організації)'),
      p(`станом на ${formatUaLong(input.date)} року`, { align: 'center', spacingBefore: 120 }),
      hint('(дата внесення останніх змін до відомості оперативного обліку)'),
      ...empty(1),
      table(
        [[
          'Порядковий номер', 'Найменування групи', 'Усього', 'Мають мобілізаційні розпорядження', 'Заброньовані',
          'Військовозобов’язані, які не заброньовані та не мають мобілізаційних розпоряджень',
          'З 1 січня 2020 р. прийнято на роботу, навчання', 'З 1 січня 2020 р. звільнено з роботи, навчання',
        ], ['1', '2', '3', '4', '5', '6', '7', '8']],
        input.rows.map((r) => [
          { text: r.code, align: 'center' as const },
          { text: r.title, bold: r.code.length <= 2 },
          num(r.total), num(r.mobilizationOrders), num(r.reserved), num(r.other), num(r.hiredSince2020), num(r.dismissedSince2020),
        ]),
        widths,
        { size: 10, headerSize: 9 },
      ),
      ...empty(2),
      signature('Особа, відповідальна за ведення військового обліку:', input.responsible?.fullName ?? '', [Math.round(w * 0.4), Math.round(w * 0.25), Math.round(w * 0.35)]),
    ], true),
  ], 'Відомість оперативного обліку');
}

// ================================================================ Envelope labels (sheet "03", rows 100–106 of the Excel file)

export interface LabelParty {
  name: string;
  address: string;
  postalCode: string;
  phone: string;
}

export interface EnvelopeLabel {
  sender: LabelParty;
  recipient: LabelParty;
}

/** Postal code: explicit value, otherwise the first 5-digit number in the address. */
export function postalCodeOf(postalCode: string | null | undefined, address: string | null | undefined): string {
  if (postalCode?.trim()) return postalCode.trim();
  return /(?:^|\D)(\d{5})(?:\D|$)/.exec(address ?? '')?.[1] ?? '';
}

function labelBlock(title: string, party: LabelParty): Paragraph[] {
  return [
    p(title, { bold: true, size: 11, spacingAfter: 60 }),
    p(blank(party.name), { bold: true, size: 13 }),
    p(blank(party.address), { size: 12 }),
    p(party.postalCode ? `Індекс: ${party.postalCode}` : 'Індекс: ________', { bold: true, size: 14, spacingBefore: 60 }),
    ...(party.phone ? [p(`тел. ${party.phone}`, { size: 11 })] : []),
  ];
}

/**
 * Envelope labels "Відправник / Отримувач" — several per A4 page, cut along the borders.
 * One label per letter (sender — the organization, recipient — the TCK of the letter).
 */
export async function buildEnvelopeLabels(labels: EnvelopeLabel[]): Promise<Buffer> {
  const w = CONTENT_WIDTH.portrait;
  const half = Math.floor(w / 2);
  const children = labels.flatMap((label) => [
    new Table({
      rows: [
        new TableRow({
          cantSplit: true,
          height: { value: 3100, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({ children: labelBlock('Відправник:', label.sender), width: { size: half, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 160, right: 160 } }),
            new TableCell({ children: labelBlock('Отримувач:', label.recipient), width: { size: w - half, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 160, right: 160 } }),
          ],
        }),
      ],
      width: { size: w, type: WidthType.DXA },
      columnWidths: [half, w - half],
      layout: TableLayoutType.FIXED,
      borders: {
        top: DASHED, bottom: DASHED, left: DASHED, right: DASHED,
        insideHorizontal: DASHED, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
      },
    }),
    p('', { spacingAfter: 240 }),
  ]);
  return render([section(children)], 'Наклейки на конверти');
}

const DASHED = { style: BorderStyle.DASHED, size: 6, color: '777777' };
