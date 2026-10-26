/**
 * Побудова документів. Тексти та структура — з картки працівника (рядки 30–100, 116–147)
 * та аркушів G1…G4R, OCL файлу new_military_list v8.6.
 */
import type { Paragraph, Table } from 'docx';
import { formatUa, formatUaLong, type IsoDate } from '../common/utils/dates.js';
import type { Tck } from '../dictionaries/tck.entity.js';
import type { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import type { Employee } from '../employees/entities/employee.entity.js';
import { CHANGE_TYPE_LABELS, type ListGroup, LIST_GROUP_TITLES } from '../military/dictionaries.js';
import {
  actualAddressText,
  fullName,
  militaryDocText,
  rankText,
} from '../military/employee-format.js';
import type { Organization } from '../organization/organization.entity.js';
import type { ResponsiblePerson } from '../organization/responsible-person.entity.js';
import {
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

// ================================================================ Повідомлення про зміну облікових даних

export interface ChangeNoticeInput {
  letter: { number: string; date: IsoDate };
  employee: Employee;
  changes: EmployeeChange[];
  org: Organization;
  responsible: ResponsiblePerson | null;
}

function changeDescription(c: EmployeeChange, e: Employee): string {
  const ending = e.gender === 'F' ? 'а' : 'ий';
  switch (c.type) {
    case 'LAST_NAME':
      return `Зміна прізвища на ${c.newValue}`;
    case 'FIRST_NAME':
      return `Зміна власного імені на ${c.newValue}`;
    case 'MIDDLE_NAME':
      return `Зміна по батькові на ${c.newValue}`;
    case 'POSITION':
      return `Зміна посади. Переведен${ending} на посаду ${c.newValue}`;
    case 'REGISTERED_ADDRESS':
      return `Зміна зареєстрованого місця проживання: ${c.newValue}`;
    case 'ACTUAL_ADDRESS':
      return `Зміна фактичного місця проживання: ${c.newValue}`;
    case 'PASSPORT':
      return `Заміна внутрішнього паспорта: ${c.newValue}`;
    case 'FOREIGN_PASSPORT':
      return `Отримано закордонний паспорт: ${c.newValue}`;
    case 'EDUCATION':
      return `Здобуто освіту - ${c.newValue}`;
    case 'MARITAL_STATUS':
      return `Зміна сімейного стану. ${c.newValue}`;
    case 'HIRE':
      return `Прийняття на роботу. Прийнят${ending} на посаду ${c.newValue}`;
    case 'DISMISSAL':
      return 'Звільнення з роботи';
  }
}

function noticeNumber(letterNumber: string, index: number, total: number) {
  return total > 1 ? `${letterNumber}/${index + 1}` : letterNumber;
}

function noticePage(input: ChangeNoticeInput, change: EmployeeChange, index: number): (Paragraph | Table)[] {
  const { employee: e, org, letter } = input;
  const w = CONTENT_WIDTH.portrait;
  const row = (label: string, value: string): (string | CellSpec)[] => [
    { text: label, size: 11 },
    { text: value, size: 11, bold: true },
  ];

  return [
    twoColumns([p('')], [p('Додаток 4', { size: 10 }), p('до Порядку', { size: 10 })], [w - 2600, 2600]),
    ...empty(1),
    twoColumns(
      [p(`вих. № ${noticeNumber(letter.number, index, input.changes.length)}`), p(`від ${formatUa(letter.date)} р.`)],
      [p(tckGenitive(e.tck).replace(/^./, (c) => c.toUpperCase()), { underline: true }),
        hint('(найменування районного (міського) територіального центру комплектування та соціальної підтримки, органу СБУ, підрозділу Служби зовнішньої розвідки)')],
      [w / 2, w / 2],
    ),
    ...empty(1),
    p('ПОВІДОМЛЕННЯ', { bold: true, align: 'center', size: 14 }),
    p('про зміну облікових даних', { bold: true, align: 'center', size: 14, spacingAfter: 200 }),
    table([], [
      row('1. Прізвище, власне ім’я та по батькові (за наявності)', fullName(e)),
      row('2. Реєстраційний номер облікового запису Єдиного державного реєстру призовників, військовозобов’язаних та резервістів', blank(e.registryNumber)),
      row('3. Військово-обліковий документ', blank(militaryDocText(e))),
      row('4. Номер військово-облікової спеціальності', blank(e.vos)),
      row('5. Військове звання', blank(rankText(e), e.rankCode === 0 ? 'призовник' : '________________')),
      row('6. Дата народження', formatUa(e.birthDate)),
      row('7. Зміна облікових даних', changeDescription(change, e)),
      row('8. Підстава для зміни облікових даних (найменування документа, номер та дата видачі)', blank(change.basis)),
      row('9. Перебування на військовому обліку', blank(e.tck?.name)),
      row('10. Адреса задекларованого/зареєстрованого місця проживання', blank(e.registeredAddress)),
      row('11. Адреса фактичного місця проживання', blank(actualAddressText(e))),
    ], [Math.round(w * 0.45), Math.round(w * 0.55)], { borders: false }),
    ...empty(2),
    signature(`${org.headPosition} ${org.shortName}`.trim(), org.headName, [Math.round(w * 0.45), Math.round(w * 0.22), Math.round(w * 0.33)]),
    hint('(найменування посади керівника державного органу, органу місцевого самоврядування, підприємства, установи, організації)', 'left'),
  ];
}

export async function buildChangeNotice(input: ChangeNoticeInput): Promise<Buffer> {
  const { employee: e, org, letter, changes, responsible } = input;
  const w = CONTENT_WIDTH.portrait;
  const declined = await inGenitive({ ...e, middleName: e.middleName });
  const [family, given, patronymic] = declined.split(' ');
  const who = e.gender === 'F' ? 'працівниці' : 'працівника';
  const which = e.gender === 'F' ? 'яка' : 'який';
  const attachments = changes.map(
    (c, i) => `${i + 1}. Повідомлення про зміну облікових даних від ${formatUa(letter.date)} р. № ${noticeNumber(letter.number, i, changes.length)} (${CHANGE_TYPE_LABELS[c.type]}) на 1 арк.`,
  );

  const cover: (Paragraph | Table)[] = [
    twoColumns(orgHeader(org), [
      p(`Керівнику ${tckGenitive(e.tck)}`, { bold: true }),
      p(e.tck?.address ?? ''),
    ], [w / 2, w / 2]),
    ...empty(1),
    p(`Вих. № ${letter.number}`),
    p(`від ${formatUa(letter.date)} р.`),
    ...empty(1),
    p(`Щодо повідомлення про зміну облікових даних ${who}`, { bold: true, italics: true }),
    ...empty(1),
    p(
      `У відповідності до п. 34 Порядку організації та ведення військового обліку призовників, військовозобов’язаних та резервістів, ` +
      `затвердженого постановою Кабінету Міністрів України від 30 грудня 2022 р. № 1487, надсилаємо повідомлення про зміну облікових даних ` +
      `${who} ${org.shortName} ${[given, patronymic].filter(Boolean).join(' ')} ${(family ?? e.lastName).toUpperCase()}, ` +
      `дата народження - ${formatUa(e.birthDate)} р., ${which} перебуває на обліку в ${blank(e.tck?.name)}.`,
      { align: 'justify', indent: 567 },
    ),
    ...empty(1),
    p(changes.length === 1 ? 'Додаток:' : 'Додатки:', { bold: true }),
    ...attachments.map((a) => p(a, { indent: 567 })),
    ...empty(2),
    signature(org.headPosition, org.headName, [Math.round(w * 0.45), Math.round(w * 0.22), Math.round(w * 0.33)]),
    ...executor(responsible),
  ];

  const notices = changes.flatMap((c, i) => [pageBreak(), ...noticePage(input, c, i)]);

  const inventory = inventoryPage({
    org,
    tck: e.tck,
    items: [`Лист щодо повідомлення про зміну облікових даних працівника від ${formatUa(letter.date)} року № ${letter.number} з додатками (аркушів - ${1 + changes.length})`],
  });

  return render([section([...cover, ...notices, pageBreak(), ...inventory])], `Повідомлення ${letter.number}`);
}

// ================================================================ Опис вкладення ф.107

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

// ================================================================ Списки персонального військового обліку (Додаток 13)

export const LIST_COLUMNS = [
  'Порядковий номер',
  'Військове звання',
  'Прізвище, власне ім’я та по батькові (за наявності)',
  'Число, місяць, рік народження',
  'Реєстраційний номер облікового запису в Єдиному державному реєстрі призовників, військовозобов’язаних та резервістів / реєстраційний номер облікової картки платника податків',
  'Військово-облікова спеціальність',
  'Склад (профіль підготовки - для офіцера)',
  'Категорія обліку (для офіцерів розряд), військово-обліковий документ (серія, номер)',
  'Відомості про освіту та спеціальність (серія та номер диплома, свідоцтва, сертифіката тощо)',
  'Реквізити паспорта громадянина України та паспорта громадянина України для виїзду за кордон (серія (за наявності), номер, ким та коли видано)',
  'Адреса задекларованого (зареєстрованого) місця проживання',
  'Адреса місця проживання',
  'Найменування ТЦК та СП, органу СБУ, підрозділу Служби зовнішньої розвідки, де перебуває на військовому обліку',
  'Перебування на спеціальному обліку або номер команди/служба у військовому резерві',
  'Придатність до військової служби',
  'Сімейний стан, прізвище, власне ім’я та по батькові (за наявності) членів сім’ї та рік їх народження',
  'Посада, реквізити акта про призначення/ звільнення на посаду/з посади',
  'Реквізити повідомлення про призначення/ звільнення на посаду/з посади',
] as const;

/** Відносні ширини колонок у списку. */
const LIST_WEIGHTS = [3, 6, 9, 6, 8, 5, 6, 8, 8, 10, 8, 8, 8, 7, 6, 9, 9, 7];

export interface ListsInput {
  date: IsoDate;
  extract: boolean;
  groups: { group: ListGroup; rows: string[][] }[];
  org: Organization;
  responsible: ResponsiblePerson | null;
  letter?: { number: string; date: IsoDate } | null;
}

export async function buildLists(input: ListsInput): Promise<Buffer> {
  const w = CONTENT_WIDTH.landscape;
  const total = LIST_WEIGHTS.reduce((a, b) => a + b, 0);
  const widths = LIST_WEIGHTS.map((x) => Math.floor((w * x) / total));

  const sections = input.groups.map(({ group, rows }) =>
    section([
      p(`Вихідний номер: ${input.letter?.number ?? '__________'}`, { size: 10 }),
      p(`Дата: ${input.letter ? `${formatUa(input.letter.date)} р.` : '__________'}`, { size: 10 }),
      ...empty(1),
      p(input.extract ? 'ВИТЯГ із СПИСКІВ' : 'СПИСКИ', { bold: true, align: 'center', size: 13 }),
      p(`персонального військового обліку ${LIST_GROUP_TITLES[group]} які працюють в ${blank(input.org.nameLocative || input.org.fullName)}`, { bold: true, align: 'center', size: 12 }),
      p(`станом на ${formatUa(input.date)} року`, { align: 'center', spacingAfter: 120 }),
      table(
        [LIST_COLUMNS.map((c) => c), LIST_COLUMNS.map((_, i) => String(i + 1))],
        rows.length ? rows : [[{ text: 'Особи відсутні', colSpan: LIST_COLUMNS.length, align: 'center' }]],
        widths,
        { size: 8, headerSize: 7 },
      ),
      ...empty(2),
      signature(input.org.headPosition, input.org.headName, [Math.round(w * 0.4), Math.round(w * 0.25), Math.round(w * 0.35)]),
      ...empty(1),
      signature('Особа, відповідальна за ведення військового обліку', input.responsible?.fullName ?? '', [Math.round(w * 0.4), Math.round(w * 0.25), Math.round(w * 0.35)]),
    ], true),
  );
  return render(sections, input.extract ? 'Витяг зі списків' : 'Списки персонального військового обліку');
}

// ================================================================ Відомість оперативного обліку (Додаток 12)

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
