/**
 * Texts and structure follow the employee card (rows 30–100, 116–147)
 * and sheets G1…G4R, OCL of the file new_military_list v8.6.
 */
import {
  AlignmentType,
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
import {
  A4_MM,
  ENVELOPE_SIZES,
  LABEL_PHONE_BLANK,
  LABEL_TITLES,
  POSTAL_CODE_DIGITS,
  PRINT_EDGE_MM,
} from './label-settings.constants.js';
import { labelScale, labelsPerPage, postalLine, scaledLabelSettings, twips } from './utils/label-settings.utils.js';
import type {
  LabelLine,
  LabelPartyKey,
  LabelPrintGroup,
  LabelSettings,
} from '../shared/interfaces/label-settings.interface.js';
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
import { postalAddressLines } from './utils/postal-address.utils.js';
import type { ListSection } from '../shared/interfaces/dictionary.interface.js';
import type { ListColumnKey } from '../shared/interfaces/list-settings.interface.js';
import { formColumnNumbers } from '../reports/lists/utils/list-layout.utils.js';
import type {
  NoticeSnapshot,
  CellSpec,
  NoticeItem,
  ChangeNoticeInput,
  ListsInput,
  ListDocumentSection,
  OperationalInput,
  LabelParty,
  EnvelopeLabel,
} from '../shared/interfaces/document.interface.js';
import type {
  InventoryInput,
  ReconciliationInput,
  ReconciliationPerson,
} from '../shared/interfaces/document.interface.js';
import { EVOD_COPIES, EXTRACT_COPIES } from './documents.constants.js';

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
  const inventory = inventorySection({
    org,
    tck,
    items: [
      {
        name: `Лист щодо повідомлення про зміну облікових даних ${single ? 'працівника' : 'працівників'} від ${formatUa(letter.date)} року № ${letter.number} з додатками`,
        copies: 1,
        sheets: String(1 + total),
      },
    ],
  });

  return render([section([...cover, ...pages]), inventory], `Повідомлення ${letter.number}`);
}

// Inventory of contents, form 107 (the Ukrposhta blank)

/** Page margins of form 107: A4 landscape, two copies side by side (as the Ukrposhta blank is printed). */
const F107_MARGIN = 567;
/** The gap between the two copies — the cut line runs in its middle. */
const F107_GAP = 567;

/** «…, на 3 арк.»: the sheets of one copy; nobody counted them — a place for the pen. */
const withSheets = (name: string, sheets?: string) => `${name}, на ${sheets || '____'} арк.`;

/** The address on form 107 — the same as on the envelope: the street first, the index last (Rules, cl. 32). */
const f107Address = (tck: Tck | null | undefined) => {
  if (!tck?.address) return '';
  return postalAddressLines(tck.address, tck.postalCode).join(', ');
};

/**
 * One copy of form 107 «Опис вкладення» as Ukrposhta prints it: the kind of the item and its number,
 * the post office, «На ім’я» and «Куди» exactly as on the envelope, the table «№ з/п · Найменування предметів ·
 * Кількість предметів · Оголошена цінність, грн» with one line per document and the total, the sender's
 * signature, «Перевірив» of the post office worker and the place for the calendar stamp. The declared value is
 * written by hand (in whole hryvnias, every line) — without it the letter is not a valuable one.
 */
function inventoryForm(input: InventoryInput, w: number): (Paragraph | Table)[] {
  const items = input.items.map((i) => (typeof i === 'string' ? { name: i, copies: 1 } : i));
  const copies = items.reduce((n, i) => n + i.copies, 0);
  const sender = input.org.fullName || input.org.shortName;
  const line = (label: string, value: string, filler = '______________________________________') =>
    p([run(`${label}  `, { size: 11 }), run(value || filler, { underline: !!value, size: 11 })], { spacingAfter: 60 });
  return [
    p('ф. 107', { align: 'right', size: 9 }),
    p('ОПИС ВКЛАДЕННЯ', { bold: true, align: 'center', size: 13 }),
    p(
      [
        run('у  ', { size: 11 }),
        run('цінному листі', { underline: true, size: 11 }),
        run('  № ____________________', { size: 11 }),
      ],
      {
        align: 'center',
      },
    ),
    hint('(вид поштового відправлення)'),
    p('', { size: 6 }),
    line('Найменування об’єкта поштового зв’язку', '', '_____________________________'),
    line('На ім’я', input.tck?.name ?? ''),
    line('Куди', f107Address(input.tck)),
    p('', { size: 6 }),
    table(
      [['№ з/п', 'Найменування предметів', 'Кількість предметів', 'Оголошена цінність, грн']],
      [
        ...items.map((item, i) => [
          { text: String(i + 1), align: 'center' as const },
          withSheets(item.name, item.sheets),
          { text: String(item.copies), align: 'center' as const },
          '',
        ]),
        [
          { text: 'Загальний підсумок кількості предметів та оголошеної цінності', colSpan: 2, bold: true },
          { text: String(copies), align: 'center' as const, bold: true },
          '',
        ],
      ],
      [
        Math.round(w * 0.09),
        Math.round(w * 0.55),
        Math.round(w * 0.16),
        w - Math.round(w * 0.09) - Math.round(w * 0.55) - Math.round(w * 0.16),
      ],
      { size: 9, headerSize: 8 },
    ),
    p('', { size: 8 }),
    p([run('Відправник  ', { size: 11 }), run(sender, { underline: true, size: 11 })]),
    p('', { size: 6 }),
    twoColumns(
      [
        p('______________________', { size: 11 }),
        hint('(підпис)', 'left'),
        p('', { size: 6 }),
        p('Перевірив  ______________________', { size: 11 }),
        hint('(підпис працівника поштового зв’язку)', 'left'),
      ],
      [p('Відбиток', { align: 'center', size: 9 }), p('календарного штемпеля', { align: 'center', size: 9 })],
      [Math.round(w * 0.62), w - Math.round(w * 0.62)],
    ),
    p('', { size: 6 }),
    p('Виправлення не допускаються. Незаповнені рядки прокреслюються.', { size: 8, italics: true }),
  ];
}

/**
 * Form 107 in two identical copies side by side on an A4 landscape sheet, a dashed cut line between them:
 * the post office stamps both, one goes into the envelope, the other stays with the sender.
 */
function inventorySection(input: InventoryInput): ISectionOptions {
  const total = A4.height - 2 * F107_MARGIN;
  const half = Math.floor((total - F107_GAP) / 2);
  const cut = { style: BorderStyle.DASHED, size: 4, color: '999999' };
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const copy = (right: boolean) =>
    new TableCell({
      children: inventoryForm(input, half),
      width: { size: half, type: WidthType.DXA },
      verticalAlign: VerticalAlign.TOP,
      borders: { top: none, bottom: none, left: none, right: none },
      margins: right ? { left: 0, right: 0 } : { left: 0, right: 0 },
    });
  const gap = (side: 'left' | 'right') =>
    new TableCell({
      children: [p('', { size: 1 })],
      width: { size: F107_GAP / 2, type: WidthType.DXA },
      borders: { top: none, bottom: none, left: side === 'left' ? none : cut, right: side === 'left' ? cut : none },
    });
  const sheet = new Table({
    rows: [new TableRow({ cantSplit: true, children: [copy(false), gap('left'), gap('right'), copy(true)] })],
    width: { size: total, type: WidthType.DXA },
    columnWidths: [half, F107_GAP / 2, F107_GAP / 2, half],
    layout: TableLayoutType.FIXED,
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
  });
  return section([sheet, pageTail(false)], true, {
    top: F107_MARGIN,
    bottom: F107_MARGIN,
    left: F107_MARGIN,
    right: F107_MARGIN,
  });
}

/** Form 107 alone — for a letter whose document has no inventory of its own (the operational report). */
export async function buildInventory(input: InventoryInput & { title: string }): Promise<Buffer> {
  return render([inventorySection(input)], input.title);
}

// Reconciliation: the cover letter and the inventory (form 107) for extracts sent to a TCK

/** «1 особа», «3 особи», «12 осіб». */
export function peopleCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'особа'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'особи'
        : 'осіб';
  return `${n} ${word}`;
}

/** «Витяг зі списку персонального військового обліку призовників» / «Список …» — one item of the package. */
export function reconciliationItem(section: ListSection, extract: boolean): string {
  return `${extract ? 'Витяг зі списку' : 'Список'} персонального військового обліку ${LIST_SECTION_TITLES[section]}`;
}

/** «ІВАНЕНКО Іван Іванович» — as in the letters to the TCK. */
const upperName = (p: ReconciliationPerson) =>
  [p.lastName.toUpperCase(), p.firstName, p.middleName].filter(Boolean).join(' ');

/** «Військово-обліковий документ в електронній формі ІВАНЕНКО Іван Іванович, сформований 12.03.2026 о 14:30». */
export function evodItem(person: ReconciliationPerson): string {
  const e = person.evod;
  const when = e?.generatedDate
    ? `, сформований ${formatUa(e.generatedDate)}${e.generatedTime ? ` о ${e.generatedTime}` : ''}`
    : '';
  return `Військово-обліковий документ в електронній формі ${upperName(person)}${when}`;
}

/** The attachments of the cover letter: the extracts (2 copies) and the eВОД of every person (1 copy). */
export function reconciliationAttachments(input: Pick<ReconciliationInput, 'sections' | 'people' | 'extract'>) {
  return [
    ...input.sections.map((s) => ({
      name: `${reconciliationItem(s.section, input.extract)} (${peopleCount(s.people)})`,
      copies: EXTRACT_COPIES,
      sheets: '',
    })),
    ...input.people.map((p) => ({ name: evodItem(p), copies: EVOD_COPIES, sheets: '1' })),
  ];
}

/**
 * The reconciliation package of one TCK:
 *  - cover — the cover letter («Щодо звірки облікових даних») with the people of the extract and the attachments
 *    (the extract in 2 copies, the eВОД of each person in 1) — the inventory for the post goes apart (form 107);
 *  - inventory — the inventory for the post office (form 107).
 * The number of sheets of the extract is left for the pen: Word decides the pagination.
 */
export async function buildReconciliation(input: ReconciliationInput): Promise<Buffer> {
  const { org, letter, tck, extract, people } = input;
  const w = CONTENT_WIDTH.portrait;
  const attachments = reconciliationAttachments(input);
  const ref = `від ${formatUa(letter.date)} р. № ${letter.number}`;

  if (input.part === 'inventory') {
    const post = inventorySection({
      org,
      tck,
      items: [
        { name: `Лист щодо звірки облікових даних ${ref}`, copies: 1 },
        ...attachments.map((a) => ({ name: a.name, copies: a.copies, sheets: a.sheets })),
      ],
    });
    return render([post], `Опис вкладення ${letter.number}`);
  }

  const what = extract ? 'витяги зі списків' : 'списки';
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
    p('Щодо звірки облікових даних', { bold: true, italics: true }),
    ...empty(1),
    p(
      `Відповідно до Порядку організації та ведення військового обліку призовників, військовозобов’язаних та резервістів, ` +
        `затвердженого постановою Кабінету Міністрів України від 30 грудня 2022 р. № 1487, надсилаємо для проведення звірки облікових даних ` +
        `${what} персонального військового обліку призовників, військовозобов’язаних та резервістів, які працюють в ` +
        `${blank(org.nameLocative || org.fullName)}${extract ? ' та перебувають на військовому обліку у Вашому територіальному центрі комплектування та соціальної підтримки' : ''}, ` +
        `станом на ${formatUa(input.reportDate)} р.${people.length ? ', а саме:' : ''}`,
      { align: 'justify', indent: 567 },
    ),
    ...people.map((person, i) =>
      p(
        `${i + 1}. ${upperName(person)}${person.birthDate ? `, дата народження - ${formatUa(person.birthDate)} р.` : ''}`,
        { align: 'justify', indent: 567 },
      ),
    ),
    p('Про виявлені розбіжності просимо повідомити.', { align: 'justify', indent: 567 }),
    ...empty(1),
    p(attachments.length === 1 ? 'Додаток:' : 'Додатки:', { bold: true }),
    ...attachments.map((a, i) =>
      p(`${i + 1}. ${a.name} на ${a.sheets || '___'} арк. в ${a.copies} прим.`, { indent: 567 }),
    ),
    ...empty(2),
    signature(org.headPosition, org.headName, [Math.round(w * 0.45), Math.round(w * 0.22), Math.round(w * 0.33)]),
    ...executor(input.responsible),
  ];

  return render([section(cover)], `Супровідний лист ${letter.number}`);
}

// Personal military registration lists (Annex 5, ed. 2025)

/** Page margins of sheets GN* (landscape, 0.7" left/right, 0.75" top/bottom). */
const LIST_MARGINS = { top: 1080, bottom: 1080, left: 1008, right: 1008 };

/** «персонального військового обліку … , які працюють в …» — the line under the title of a list. */
export function listSubtitle(section: ListSection | null, org: Organization) {
  const whom = section ? LIST_SECTION_TITLES[section] : 'призовників, військовозобов’язаних та резервістів';
  return `персонального військового обліку ${whom}, які працюють в ${blank(org.nameLocative || org.fullName)}`;
}

/** «СПИСКИ» / «ВИТЯГ ІЗ СПИСКІВ» unless the settings name it otherwise. */
export const listTitle = (custom: string, extract: boolean) =>
  custom.trim() || (extract ? 'ВИТЯГ ІЗ СПИСКІВ' : 'СПИСКИ');

/**
 * Personal military registration lists laid out like sheets GN* of the Excel file: four separate lists
 * (officers; rank-and-file, sergeants and petty officers; women; conscripts — reservists together with
 * their composition), each on its own landscape page(s). The columns, the order of the rows, the sub-headings,
 * the heading and the signers — by the list settings of the legal entity (columns are numbered as in the form).
 */
export async function buildLists(input: ListsInput): Promise<Buffer> {
  const contentWidth = A4.height - LIST_MARGINS.left - LIST_MARGINS.right;
  const size = 8;
  const sign = [Math.round(contentWidth * 0.3), Math.round(contentWidth * 0.2), Math.round(contentWidth * 0.3)] as [
    number,
    number,
    number,
  ];

  const groupSection = (part: ListDocumentSection | null) => {
    const columns = part?.layout.columns ?? [];
    const indexes = columns.length ? formColumnNumbers(columns).map((n) => n - 1) : LIST_TITLES.map((_, i) => i);
    const relative = indexes.map((i) => LIST_WIDTHS[i]);
    const total = relative.reduce((a, b) => a + b, 0);
    const widths = relative.map((w) => Math.floor((contentWidth * w) / total));
    const header = [
      indexes.map((i) => ({ text: LIST_TITLES[i], size: 7, align: 'center' as const })),
      indexes.map((i) => ({ text: String(i + 1), align: 'center' as const })),
    ];
    const centered = new Set([0, 4]);
    const body: CellSpec[][] = [];
    for (const group of part?.layout.groups ?? []) {
      if (group.title) body.push([{ text: group.title, bold: true, colSpan: indexes.length, size, keepNext: true }]);
      for (const row of group.rows) {
        body.push(
          row.map((text, c) => ({ text, size, align: centered.has(indexes[c]) ? ('center' as const) : undefined })),
        );
      }
    }
    if (!body.length) body.push([{ text: 'Особи відсутні', colSpan: indexes.length, align: 'center', size }]);
    const settings = part?.settings;
    const signers = part?.signers ?? [{ position: input.org.headPosition, name: input.org.headName }];
    return section(
      [
        ...(settings?.showOutgoing === false
          ? []
          : [
              p(`Вихідний номер   ${input.letter?.number ?? '__________'}`, { size: 10 }),
              p(`Дата   ${input.letter ? `${formatUa(input.letter.date)} р.` : '__________'}`, { size: 10 }),
              ...empty(1),
            ]),
        p(listTitle(settings?.title ?? '', input.extract), { bold: true, align: 'center' }),
        p(settings?.subtitle.trim() || listSubtitle(part?.section ?? null, input.org), { align: 'center' }),
        p(`станом на ${formatUa(input.date)} року`, { align: 'center', spacingAfter: 160 }),
        table(header, body, widths, { size, headerSize: 7 }),
        ...signers.flatMap((s) => [...empty(2), signature(s.position, s.name, sign)]),
      ],
      true,
      LIST_MARGINS,
    );
  };

  const sections = input.sections.filter((g) => g.layout.count);
  return render(
    sections.length ? sections.map((g) => groupSection(g)) : [groupSection(null)],
    input.extract ? 'Витяг зі списків' : 'Списки персонального військового обліку',
  );
}

/**
 * A starting Word template for a list: the heading, the table of the chosen columns with the row loop
 * ({#rows} in the first cell, {/rows} in the last) and the signers — to be adjusted in Word and uploaded.
 */
export async function buildListTemplateExample(list: ListSection, columns: ListColumnKey[]): Promise<Buffer> {
  const contentWidth = A4.height - LIST_MARGINS.left - LIST_MARGINS.right;
  const indexes = formColumnNumbers(columns).map((n) => n - 1);
  const relative = indexes.map((i) => LIST_WIDTHS[i]);
  const total = relative.reduce((a, b) => a + b, 0);
  const widths = relative.map((w) => Math.floor((contentWidth * w) / total));
  const header = [
    indexes.map((i) => ({ text: LIST_TITLES[i], size: 7, align: 'center' as const })),
    indexes.map((i) => ({ text: String(i + 1), align: 'center' as const })),
  ];
  const last = columns.length - 1;
  const row = columns.map((key, c) => {
    const tag = key === 'number' ? '{n}' : `{${key}}`;
    return { text: `${c === 0 ? '{#rows}' : ''}${tag}${c === last ? '{/rows}' : ''}`, size: 8 };
  });
  const sign = [Math.round(contentWidth * 0.3), Math.round(contentWidth * 0.2), Math.round(contentWidth * 0.3)] as [
    number,
    number,
    number,
  ];
  return render(
    [
      section(
        [
          p('Вихідний номер   {outNumber}', { size: 10 }),
          p('Дата   {outDate}', { size: 10 }),
          ...empty(1),
          p('{title}', { bold: true, align: 'center' }),
          p('{subtitle}', { align: 'center' }),
          p('станом на {date} року', { align: 'center', spacingAfter: 160 }),
          table(header, [row], widths, { size: 8, headerSize: 7 }),
          ...empty(1),
          p('{#signers}', { size: 2 }),
          signature('{position}', '{name}', sign),
          p('{/signers}', { size: 2 }),
        ],
        true,
        LIST_MARGINS,
      ),
    ],
    `Шаблон: ${LIST_SECTION_TITLES[list]}`,
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

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const DASHED: IBorderOptions = { style: BorderStyle.DASHED, size: 6, color: '777777' };
const DIVIDER: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const BOX: IBorderOptions = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

type LabelChild = Paragraph | Table;

/** The index digit by digit in cells, as on Ukrposhta envelopes (empty cells — to write by hand). */
function postalBoxes(code: string, s: LabelSettings): Table {
  const side = Math.round(s.postalSize * 20 * 1.45);
  const digits = code.padEnd(POSTAL_CODE_DIGITS).slice(0, POSTAL_CODE_DIGITS).split('');
  return new Table({
    rows: [
      new TableRow({
        height: { value: side, rule: HeightRule.EXACT },
        children: digits.map(
          (d) =>
            new TableCell({
              children: [p(d.trim(), { font: s.font, size: s.postalSize, bold: s.postalBold, align: 'center' })],
              width: { size: side, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              borders: { top: BOX, bottom: BOX, left: BOX, right: BOX },
            }),
        ),
      }),
    ],
    width: { size: side * POSTAL_CODE_DIGITS, type: WidthType.DXA },
    columnWidths: digits.map(() => side),
    layout: TableLayoutType.FIXED,
    alignment: s.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
    borders: NO_BORDERS,
  });
}

/**
 * One party of a label: the title («Від кого:» / «Кому:» or «Відправник:» / «Отримувач:»), then the lines in the
 * order of the settings. The index is printed once — it was taken out of the address. A table cell must end with
 * a paragraph, so after the cells of the index comes an empty one.
 */
function labelBlock(who: LabelPartyKey, party: LabelParty, s: LabelSettings): LabelChild[] {
  const o = { font: s.font, align: s.align };
  const lines: Record<LabelLine, LabelChild[]> = {
    name: [p(blank(party.name), { ...o, bold: s.nameBold, size: s.nameSize })],
    // the street with the house, then the settlement, the district, the region — a line each (Rules, cl. 32)
    address: (party.addressLines?.length ? party.addressLines : [blank(party.address)]).map((line) =>
      p(line, { ...o, size: s.addressSize }),
    ),
    postalCode:
      s.postalStyle === 'BOXES'
        ? [p('', { size: 3 }), postalBoxes(party.postalCode, s), p('', { size: 3 })]
        : [p(postalLine(party.postalCode, s.postalPrefix), { ...o, bold: s.postalBold, size: s.postalSize })],
    // the phone line is always there (as on the Ukrposhta form): an unknown number — a line for the pen
    phone: s.showPhone ? [p(`тел. ${party.phone || LABEL_PHONE_BLANK}`, { ...o, size: s.phoneSize })] : [],
  };
  const title = LABEL_TITLES[s.titleStyle][who];
  return [
    ...(s.showTitles ? [p(title, { ...o, bold: true, size: s.titleSize, spacingAfter: 60 })] : []),
    ...s.lineOrder.flatMap((line) => lines[line]),
  ];
}

/** The parties of a label in the order of the settings (the first one — to the left or on top). */
const orderedParties = (label: EnvelopeLabel, s: LabelSettings) =>
  s.partyOrder.map((who) => ({ who, party: label[who] }));

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
  const cell = (children: LabelChild[], width: number, borders: { left: IBorderOptions; right: IBorderOptions }) =>
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
        // a long name or address — smaller letters instead of a cut-off index or phone
        const t = scaledLabelSettings(s, labelScale(label, s));
        const [first, second] = orderedParties(label, s);
        cells.push(cell(labelBlock(first.who, first.party, t), labelCols[0], { left: edge, right: divider }));
        cells.push(cell(labelBlock(second.who, second.party, t), labelCols[1], { left: divider, right: edge }));
      } else {
        const t = scaledLabelSettings(s, labelScale(label, s));
        const [first, second] = orderedParties(label, s);
        const both = [
          ...labelBlock(first.who, first.party, t),
          p('', { size: 6 }),
          ...labelBlock(second.who, second.party, t),
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
            children: labelBlock('sender', label.sender, s),
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
            children: labelBlock('recipient', label.recipient, s),
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
