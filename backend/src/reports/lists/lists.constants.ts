import type {
  ListColumnKey,
  ListGrouping,
  ListSectionSettings,
  ListSort,
  TemplatePlaceholder,
} from '../../shared/interfaces/list-settings.interface.js';
import type { UserRole } from '../../shared/interfaces/auth.interface.js';
import type { ListSection } from '../../shared/interfaces/dictionary.interface.js';
import { ENTITY_MANAGERS } from '../../users/users.constants.js';

/** The cells of a list row in the order of the form (Annex 5, columns 1–18). */
export const LIST_COLUMN_KEYS: ListColumnKey[] = [
  'number',
  'category',
  'rank',
  'fullName',
  'birthDate',
  'registryNumber',
  'taxNumber',
  'vos',
  'militaryDoc',
  'passport',
  'address',
  'tck',
  'deferral',
  'reservation',
  'served',
  'mobilizationOrder',
  'position',
  'notices',
];

export const LIST_SORTS: ListSort[] = ['NAME', 'RANK', 'BIRTH_DATE'];
export const LIST_GROUPINGS: ListGrouping[] = ['NONE', 'CATEGORY', 'TCK', 'DEPARTMENT'];

export const DEFAULT_LIST_SECTION: ListSectionSettings = {
  columns: [...LIST_COLUMN_KEYS],
  sort: 'NAME',
  groupBy: 'NONE',
  title: '',
  subtitle: '',
  showOutgoing: true,
  signers: [],
  template: null,
};

export const MAX_LIST_SIGNERS = 3;
export const MAX_LIST_TITLE = 200;
export const MAX_LIST_SUBTITLE = 500;

/** Who forms the lists and sets how they look. */
export const LIST_ROLES: UserRole[] = [...ENTITY_MANAGERS, 'HR'];

/** How many formed lists the history shows. */
export const LIST_SNAPSHOTS_SHOWN = 100;

/** A Word template: the file and everything inside it unpacked (a guard against «zip bombs»). */
export const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024;
export const MAX_TEMPLATE_UNZIPPED = 30 * 1024 * 1024;

export const GROUP_WITHOUT_TCK = 'ТЦК не вказано';
export const GROUP_WITHOUT_DEPARTMENT = 'Без підрозділу';
export const GROUP_CATEGORY_TITLES = {
  LIABLE: 'Військовозобов’язані',
  RESERVIST: 'Резервісти',
  CONSCRIPT: 'Призовники',
} as const;

/** Placeholders of a template: data of the document … */
export const DOCUMENT_PLACEHOLDERS: TemplatePlaceholder[] = [
  { tag: '{title}', description: 'Заголовок: «СПИСКИ» або «ВИТЯГ ІЗ СПИСКІВ» (чи ваш із налаштувань)' },
  { tag: '{subtitle}', description: 'Рядок під заголовком: «персонального військового обліку … , які працюють в …»' },
  {
    tag: '{whom}',
    description: 'Кого містить список: «військовозобов’язаних та резервістів офіцерського складу» тощо',
  },
  { tag: '{date}', description: 'Станом на (дд.мм.рррр)' },
  { tag: '{outNumber}', description: 'Вихідний номер листа (порожньо, якщо лист не зареєстровано)' },
  { tag: '{outDate}', description: 'Дата вихідного листа' },
  { tag: '{count}', description: 'Кількість осіб у списку' },
  { tag: '{org.fullName}', description: 'Повна назва юрособи' },
  { tag: '{org.shortName}', description: 'Скорочена назва' },
  { tag: '{org.edrpou}', description: 'Код ЄДРПОУ' },
  { tag: '{org.address}', description: 'Адреса' },
  { tag: '{org.headPosition}', description: 'Посада керівника' },
  { tag: '{org.headName}', description: 'Керівник («Іван ПРИКЛАДНИЙ»)' },
  {
    tag: '{#rows} … {/rows}',
    description: 'Повторити для кожної особи (поставте в першу й останню клітинку рядка таблиці)',
  },
  {
    tag: '{#groups}{title} … {#rows}…{/rows}{/groups}',
    description: 'Те саме з підзаголовками групування (група: {title}, {count}, {#rows})',
  },
  { tag: '{#signers}{position} {name}{/signers}', description: 'Підписанти' },
];

/** … and of a row (inside {#rows}…{/rows}). */
export const ROW_PLACEHOLDERS: Record<ListColumnKey, string> = {
  number: '{n} — порядковий номер (графа 1)',
  category: '{category} — категорія військового обов’язку (2)',
  rank: '{rank} — військове звання (3)',
  fullName: '{fullName} — ПІБ (4)',
  birthDate: '{birthDate} — дата народження (5)',
  registryNumber: '{registryNumber} — номер в Оберегу (6)',
  taxNumber: '{taxNumber} — РНОКПП (7)',
  vos: '{vos} — ВОС (8)',
  militaryDoc: '{militaryDoc} — військово-обліковий документ (9)',
  passport: '{passport} — паспорт (10)',
  address: '{address} — адреса (11)',
  tck: '{tck} — ТЦК (12)',
  deferral: '{deferral} — відстрочка (13)',
  reservation: '{reservation} — спецоблік / бронювання (14)',
  served: '{served} — проходження служби (15)',
  mobilizationOrder: '{mobilizationOrder} — мобілізаційне розпорядження (16)',
  position: '{position} — посада (17)',
  notices: '{notices} — повідомлення про призначення / звільнення (18)',
};

/** Tags a template may use (anything else is most likely a typo). */
export const KNOWN_TEMPLATE_TAGS = new Set([
  'title',
  'subtitle',
  'whom',
  'date',
  'outNumber',
  'outDate',
  'count',
  'extract',
  'org',
  'org.fullName',
  'org.shortName',
  'org.edrpou',
  'org.address',
  'org.headPosition',
  'org.headName',
  'rows',
  'groups',
  'signers',
  'position',
  'name',
  'n',
  ...LIST_COLUMN_KEYS,
]);

/** File names of the lists inside a .zip (several lists with own templates). */
export const LIST_FILE_NAMES: Record<ListSection, string> = {
  OFFICERS: '1 Офіцерський склад',
  SOLDIERS: '2 Рядовий, сержантський і старшинський склад',
  WOMEN: '3 Жінки',
  CONSCRIPTS: '4 Призовники',
};
