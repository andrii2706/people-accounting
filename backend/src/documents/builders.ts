/**
 * Texts and structure follow the employee card (rows 30–100, 116–147)
 * and sheets G1…G4R, OCL of the file new_military_list v8.6.
 */
import {
  BorderStyle,
  HeightRule,
  type IBorderOptions,
  type ISectionOptions,
  type Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  VerticalAlign,
  WidthType,
} from 'docx';
import { A4_MM, ENVELOPE_SIZES, PRINT_EDGE_MM } from './label-settings.constants.js';
import { labelsPerPage, twips } from './utils/label-settings.utils.js';
import type { LabelPrintGroup, LabelSettings } from '../shared/interfaces/label-settings.interface.js';
import { formatUa, formatUaLong } from '../common/utils/dates.utils.js';
import type { Tck } from '../dictionaries/tck.entity.js';
import { CHANGE_TYPE_LABELS, LIST_SECTION_TITLES } from '../military/dictionaries.js';
import { LIST_TITLES, LIST_WIDTHS } from '../military/personal-list.js';
import type { Organization } from '../organization/organization.entity.js';
import type { ResponsibleInfo } from '../shared/interfaces/document.interface.js';
import {
  A4,
  CONTENT_WIDTH,
  empty,
  hint,
  p,
  pageBreak,
  pageTail,
  render,
  run,
  section,
  signature,
  sizedSection,
  table,
  twoColumns,
} from './docx-kit.js';
import { inGenitive } from './name-declension.js';
import type { ListSection } from '../shared/interfaces/dictionary.interface.js';
import type {
  NoticeSnapshot,
  CellSpec,
  NoticeItem,
  ChangeNoticeInput,
  ListsInput,
  OperationalInput,
  LabelParty,
  EnvelopeLabel,
} from '../shared/interfaces/document.interface.js';
import type { InventoryInput } from '../shared/interfaces/document.interface.js';

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

function executor(person: ResponsibleInfo | null): Paragraph[] {
  if (!person) return [];
  return [...empty(2), p(`Виконавець: ${person.fullName}${person.phone ? `, тел. ${person.phone}` : ''}`, { size: 9 })];
}

// Change notices (Annex 4) with a cover letter

export function noticeNumber(letterNumber: string, sequence: number, total: number) {
  return total > 1 ? `${letterNumber}/${sequence}` : letterNumber;
}

const snapshotName = (n: NoticeSnapshot) => [n.lastName, n.firstName, n.middleName].filter(Boolean).join(' ');

function noticePage(
  n: NoticeItem,
  ctx: { letter: ChangeNoticeInput['letter']; org: Organization; total: number; tckGenitiveName: string },
): (Paragraph | Table)[] {
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
      [
        p(
          ctx.tckGenitiveName.replace(/^./, (c) => c.toUpperCase()),
          { underline: true },
        ),
        hint(
          '(найменування районного (міського) територіального центру комплектування та соціальної підтримки, органу СБУ, підрозділу Служби зовнішньої розвідки)',
        ),
      ],
      [w / 2, w / 2],
    ),
    ...empty(1),
    p('ПОВІДОМЛЕННЯ', { bold: true, align: 'center', size: 14 }),
    p('про зміну облікових даних', { bold: true, align: 'center', size: 14, spacingAfter: 200 }),
    table(
      [],
      [
        row('1. Прізвище, власне ім’я та по батькові (за наявності)', snapshotName(n)),
        row(
          '2. Реєстраційний номер облікового запису Єдиного державного реєстру призовників, військовозобов’язаних та резервістів',
          blank(n.registryNumber),
        ),
        row('3. Військово-обліковий документ', blank(n.militaryDoc)),
        row('4. Номер військово-облікової спеціальності', blank(n.vos)),
        row('5. Військове звання', blank(n.rank, n.conscript ? 'призовник' : '________________')),
        row('6. Дата народження', formatUa(n.birthDate)),
        row('7. Зміна облікових даних', n.change),
        row('8. Підстава для зміни облікових даних (найменування документа, номер та дата видачі)', blank(n.basis)),
        row('9. Перебування на військовому обліку', blank(n.tckName)),
        row('10. Адреса задекларованого/зареєстрованого місця проживання', blank(n.registeredAddress)),
        row('11. Адреса фактичного місця проживання', blank(n.actualAddress)),
      ],
      [Math.round(w * 0.45), Math.round(w * 0.55)],
      { borders: false },
    ),
    ...empty(2),
    signature(`${ctx.org.headPosition} ${ctx.org.shortName}`.trim(), ctx.org.headName, [
      Math.round(w * 0.45),
      Math.round(w * 0.22),
      Math.round(w * 0.33),
    ]),
    hint(
      '(найменування посади керівника державного органу, органу місцевого самоврядування, підприємства, установи, організації)',
      'left',
    ),
  ];
}

/** A single notice (Annex 4) without the cover letter — e.g. to re-print it from the employee card. */
export async function buildSingleNotice(
  input: Omit<ChangeNoticeInput, 'notices'> & { notice: NoticeItem; total: number },
): Promise<Buffer> {
  const page = noticePage(input.notice, {
    letter: input.letter,
    org: input.org,
    total: input.total,
    tckGenitiveName: tckGenitive(input.tck),
  });
  return render(
    [section(page)],
    `Повідомлення ${noticeNumber(input.letter.number, input.notice.sequence, input.total)}`,
  );
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
    (n) =>
      `${n.sequence}. Повідомлення про зміну облікових даних від ${formatUa(letter.date)} р. № ${noticeNumber(letter.number, n.sequence, total)} (${CHANGE_TYPE_LABELS[n.changeType]}${single ? '' : `, ${snapshotName(n)}`}) на 1 арк.`,
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
    twoColumns(
      orgHeader(org),
      [p(`Керівнику ${tckGenitive(tck)}`, { bold: true }), p(tck?.address ?? '')],
      [w / 2, w / 2],
    ),
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
    items: [
      `Лист щодо повідомлення про зміну облікових даних ${single ? 'працівника' : 'працівників'} від ${formatUa(letter.date)} року № ${letter.number} з додатками (аркушів - ${1 + total})`,
    ],
  });

  return render([section([...cover, ...pages, pageBreak(), ...inventory])], `Повідомлення ${letter.number}`);
}

// Inventory of contents, form 107

function inventoryPage(input: InventoryInput): (Paragraph | Table)[] {
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
        ...input.items.map((item, i) => [
          { text: String(i + 1), align: 'center' as const },
          item,
          { text: '1', align: 'center' as const },
          '',
        ]),
        [
          { text: 'Загальний підсумок предметів і оголошеної цінності', colSpan: 2, bold: true },
          { text: String(input.items.length), align: 'center' as const },
          '',
        ],
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

// Personal military registration lists (Annex 5, ed. 2025)

/** Page margins of sheets GN* (landscape, 0.7" left/right, 0.75" top/bottom). */
const LIST_MARGINS = { top: 1080, bottom: 1080, left: 1008, right: 1008 };

/**
 * Personal military registration lists laid out like sheets GN* of the Excel file: four separate lists
 * (officers; rank-and-file, sergeants and petty officers; women; conscripts — reservists together with
 * their composition), each on its own landscape page(s), one row per record, columns 1–18.
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
  const sign = [Math.round(contentWidth * 0.3), Math.round(contentWidth * 0.2), Math.round(contentWidth * 0.3)] as [
    number,
    number,
    number,
  ];
  const orgText = input.org.nameLocative || input.org.fullName;

  const groupSection = (list: ListSection | null, rows: string[][]) => {
    const body = rows.length
      ? rows.map((row) =>
          row.map((text, i) => ({ text, size, align: i === 0 || i === 4 ? ('center' as const) : undefined })),
        )
      : [[{ text: 'Особи відсутні', colSpan: LIST_TITLES.length, align: 'center' as const, size }]];
    const whom = list ? LIST_SECTION_TITLES[list] : 'призовників, військовозобов’язаних та резервістів';
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

  const sections = input.sections.filter((g) => g.rows.length);
  return render(
    sections.length ? sections.map((g) => groupSection(g.section, g.rows)) : [groupSection(null, [])],
    input.extract ? 'Витяг зі списків' : 'Списки персонального військового обліку',
  );
}

// Operational registration report (Annex 12)

export async function buildOperationalReport(input: OperationalInput): Promise<Buffer> {
  const w = CONTENT_WIDTH.landscape;
  const widths = [0.07, 0.29, 0.08, 0.11, 0.1, 0.13, 0.11, 0.11].map((x) => Math.floor(w * x));
  const num = (n: number) => ({ text: n ? String(n) : '-', align: 'center' as const });

  return render(
    [
      section(
        [
          twoColumns(
            [
              p(`Вихідний № ${input.letter?.number ?? '__________'}`),
              p(`Дата ${input.letter ? formatUaLong(input.letter.date) + ' року' : '__________'}`),
            ],
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
            [
              [
                'Порядковий номер',
                'Найменування групи',
                'Усього',
                'Мають мобілізаційні розпорядження',
                'Заброньовані',
                'Військовозобов’язані, які не заброньовані та не мають мобілізаційних розпоряджень',
                'З 1 січня 2020 р. прийнято на роботу, навчання',
                'З 1 січня 2020 р. звільнено з роботи, навчання',
              ],
              ['1', '2', '3', '4', '5', '6', '7', '8'],
            ],
            input.rows.map((r) => [
              { text: r.code, align: 'center' as const },
              { text: r.title, bold: r.code.length <= 2 },
              num(r.total),
              num(r.mobilizationOrders),
              num(r.reserved),
              num(r.other),
              num(r.hiredSince2020),
              num(r.dismissedSince2020),
            ]),
            widths,
            { size: 10, headerSize: 9 },
          ),
          ...empty(2),
          signature('Особа, відповідальна за ведення військового обліку:', input.responsible?.fullName ?? '', [
            Math.round(w * 0.4),
            Math.round(w * 0.25),
            Math.round(w * 0.35),
          ]),
        ],
        true,
      ),
    ],
    'Відомість оперативного обліку',
  );
}

// Envelope labels: sheet "03", rows 100–106 of the Excel file

/** Postal code: explicit value, otherwise the first 5-digit number in the address. */
export function postalCodeOf(postalCode: string | null | undefined, address: string | null | undefined): string {
  if (postalCode?.trim()) return postalCode.trim();
  return /(?:^|\D)(\d{5})(?:\D|$)/.exec(address ?? '')?.[1] ?? '';
}

const LABEL_TITLES = { sender: 'Відправник:', recipient: 'Отримувач:' } as const;

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const DASHED: IBorderOptions = { style: BorderStyle.DASHED, size: 6, color: '777777' };
const DIVIDER: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

/** One party of a label in the font, sizes and lines of the settings. */
function labelBlock(title: string, party: LabelParty, s: LabelSettings): Paragraph[] {
  const o = { font: s.font, align: s.align };
  const postal = party.postalCode || '________';
  return [
    ...(s.showTitles ? [p(title, { ...o, bold: true, size: s.titleSize, spacingAfter: 60 })] : []),
    p(blank(party.name), { ...o, bold: s.nameBold, size: s.nameSize }),
    p(blank(party.address), { ...o, size: s.addressSize }),
    p(s.postalPrefix ? `Індекс: ${postal}` : postal, {
      ...o,
      bold: s.postalBold,
      size: s.postalSize,
      spacingBefore: 60,
    }),
    ...(s.showPhone && party.phone ? [p(`тел. ${party.phone}`, { ...o, size: s.phoneSize })] : []),
  ];
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** An empty cell: a gap between the labels or a free place in the last row. */
function blankCell(width: number, columnSpan?: number): TableCell {
  return new TableCell({
    children: [p('', { size: 1 })],
    width: { size: width, type: WidthType.DXA },
    columnSpan,
    borders: NO_BORDERS,
  });
}

/** One A4 page of labels: rows of `columns` labels of exact size, so that a sheet of stickers matches. */
function sheetPage(labels: EnvelopeLabel[], s: LabelSettings): Table {
  const w = twips(s.labelWidthMm);
  const gap = twips(s.gapMm);
  const pad = twips(s.paddingMm);
  const side = s.layout === 'SIDE_BY_SIDE';
  const half = Math.floor(w / 2);
  const labelCols = side ? [half, w - half] : [w];
  const columnWidths: number[] = [];
  for (let c = 0; c < s.columns; c++) {
    if (c && gap) columnWidths.push(gap);
    columnWidths.push(...labelCols);
  }
  const total = columnWidths.reduce((a, b) => a + b, 0);
  const edge = s.cutBorder ? DASHED : NONE;
  const divider = s.cutBorder ? DIVIDER : NONE;
  const cell = (children: Paragraph[], width: number, borders: { left: IBorderOptions; right: IBorderOptions }) =>
    new TableCell({
      children,
      width: { size: width, type: WidthType.DXA },
      margins: { top: pad, bottom: pad, left: pad, right: pad },
      borders: { top: edge, bottom: edge, ...borders },
      verticalAlign: VerticalAlign.TOP,
    });

  const rows: TableRow[] = [];
  chunk(labels, s.columns).forEach((row, r) => {
    if (r && gap) {
      rows.push(
        new TableRow({
          height: { value: gap, rule: HeightRule.EXACT },
          children: [blankCell(total, columnWidths.length)],
        }),
      );
    }
    const cells: TableCell[] = [];
    for (let c = 0; c < s.columns; c++) {
      if (c && gap) cells.push(blankCell(gap));
      const label = row[c];
      if (!label) {
        labelCols.forEach((width) => cells.push(blankCell(width)));
      } else if (side) {
        cells.push(
          cell(labelBlock(LABEL_TITLES.sender, label.sender, s), labelCols[0], { left: edge, right: divider }),
        );
        cells.push(
          cell(labelBlock(LABEL_TITLES.recipient, label.recipient, s), labelCols[1], { left: divider, right: edge }),
        );
      } else {
        const both = [
          ...labelBlock(LABEL_TITLES.sender, label.sender, s),
          p('', { size: 6 }),
          ...labelBlock(LABEL_TITLES.recipient, label.recipient, s),
        ];
        cells.push(cell(both, w, { left: edge, right: edge }));
      }
    }
    rows.push(
      new TableRow({
        cantSplit: true,
        height: { value: twips(s.labelHeightMm), rule: HeightRule.EXACT },
        children: cells,
      }),
    );
  });
  return new Table({
    rows,
    width: { size: total, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
  });
}

function sheetSection(group: LabelPrintGroup): ISectionOptions {
  const s = group.settings;
  const pages = chunk(group.labels, labelsPerPage(s));
  return sizedSection(
    pages.flatMap((page, i) => [sheetPage(page, s), pageTail(i < pages.length - 1)]),
    { width: twips(A4_MM.widthMm), height: twips(A4_MM.heightMm) },
    {
      top: twips(s.marginTopMm),
      left: twips(s.marginLeftMm),
      right: twips(PRINT_EDGE_MM),
      bottom: twips(PRINT_EDGE_MM),
    },
  );
}

/**
 * One envelope: the page starts at the sender (the margins), the recipient is shifted by the columns of
 * a borderless table and by the exact height of its first row.
 */
function envelopePage(label: EnvelopeLabel, s: LabelSettings): Table {
  const offset = twips(s.recipientXMm - s.senderXMm);
  const recipient = twips(s.recipientWidthMm);
  const sender = twips(s.senderWidthMm);
  const columnWidths = [...(offset > 0 ? [offset] : []), recipient];
  const extra = sender - columnWidths.reduce((a, b) => a + b, 0);
  if (extra > 0) columnWidths.push(extra);
  const total = columnWidths.reduce((a, b) => a + b, 0);
  const zero = { top: 0, bottom: 0, left: 0, right: 0 };
  return new Table({
    rows: [
      new TableRow({
        height: { value: twips(s.recipientYMm - s.senderYMm), rule: HeightRule.EXACT },
        children: [
          new TableCell({
            children: labelBlock(LABEL_TITLES.sender, label.sender, s),
            width: { size: total, type: WidthType.DXA },
            columnSpan: columnWidths.length,
            margins: { ...zero, right: Math.max(0, total - sender) },
            borders: NO_BORDERS,
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          ...(offset > 0 ? [blankCell(offset)] : []),
          new TableCell({
            children: labelBlock(LABEL_TITLES.recipient, label.recipient, s),
            width: { size: recipient, type: WidthType.DXA },
            margins: zero,
            borders: NO_BORDERS,
          }),
          ...(extra > 0 ? [blankCell(extra)] : []),
        ],
      }),
    ],
    width: { size: total, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
  });
}

function envelopeSection(group: LabelPrintGroup): ISectionOptions {
  const s = group.settings;
  const env = ENVELOPE_SIZES[s.envelope];
  return sizedSection(
    group.labels.flatMap((label, i) => [envelopePage(label, s), pageTail(i < group.labels.length - 1)]),
    { width: twips(env.widthMm), height: twips(env.heightMm) },
    { top: twips(s.senderYMm), left: twips(s.senderXMm), right: twips(3), bottom: twips(3) },
  );
}

/**
 * Envelope labels «Відправник / Отримувач», one per letter. Each legal entity — with its own settings:
 * labels on A4 (cut out or a sheet of stickers) or printed right on the envelope.
 */
export async function buildEnvelopeLabels(groups: LabelPrintGroup[]): Promise<Buffer> {
  const sections = groups
    .filter((g) => g.labels.length)
    .map((g) => (g.settings.mode === 'ENVELOPE' ? envelopeSection(g) : sheetSection(g)));
  return render(sections, 'Наклейки на конверти');
}
