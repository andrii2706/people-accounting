import type { SelectOption } from '../interfaces/ui.interface';
import type {
  HrBatchSource,
  HrBatchStatus,
  HrItemAction,
  HrMilitaryPolicy,
  HrSyncForm,
  HrSyncFrequency,
  HrSyncMode,
  HrSystem,
} from '../interfaces/hr-sync.interface';

export const HR_SYSTEM_OPTIONS: SelectOption<HrSystem>[] = [
  { value: 'ZUP', label: '1С / BAS: Зарплата і управління персоналом', hint: 'ЗУП 3.x, BAS ЗУП' },
  {
    value: 'BAS_ACCOUNTING',
    label: 'BAS Бухгалтерія / Комплексне',
    hint: 'кадри в бухгалтерській базі',
  },
  { value: 'OTHER', label: 'Інша система', hint: 'M.E.Doc, власна облікова система' },
];

export const HR_MODE_TEXT: Record<HrSyncMode, { label: string; hint: string }> = {
  PUSH: {
    label: '1С надсилає дані сама',
    hint: 'Обробка в 1С щодня надсилає працівників за ключем. Нічого не треба відкривати в інтернет — найнадійніше.',
  },
  ODATA: {
    label: 'Ми читаємо з 1С (OData)',
    hint: 'База 1С опублікована на веб-сервері з HTTPS; ми читаємо її щодня в обрану годину.',
  },
  FILE: {
    label: 'Файл вручну',
    hint: 'Вивантажуєте з 1С файл Excel і завантажуєте його в «Працівники → Імпорт».',
  },
};

export const HR_FREQUENCY_TEXT: Record<HrSyncFrequency, { label: string; hint: string }> = {
  ONCE: {
    label: 'Один раз',
    hint: 'Початкове завантаження: після застосування дані з 1С більше не беруться — працівники ведуться тут.',
  },
  ONGOING: {
    label: 'Постійно',
    hint: 'Зміни з 1С приходять щодня (і вручну): нові працівники, ПІБ, посади, звільнення.',
  },
};

export const HR_POLICY_OPTIONS: SelectOption<HrMilitaryPolicy>[] = [
  {
    value: 'FILL_EMPTY',
    label: 'Заповнювати лише порожні',
    hint: 'наші військові дані не перезаписуються',
  },
  {
    value: 'OVERWRITE',
    label: 'Замінювати даними з 1С',
    hint: 'якщо військовий облік ведуть у 1С',
  },
  { value: 'IGNORE', label: 'Не брати з 1С', hint: 'військові дані ведуться лише тут' },
];

export const HR_HOUR_OPTIONS: SelectOption[] = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

export const HR_STATUS_TEXT: Record<
  HrBatchStatus,
  { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }
> = {
  PENDING: { label: 'Чекає на перегляд', tone: 'warn' },
  APPLIED: { label: 'Застосовано', tone: 'ok' },
  PARTIAL: { label: 'Застосовано частково', tone: 'warn' },
  FAILED: { label: 'Не застосовано', tone: 'danger' },
  DISCARDED: { label: 'Відхилено', tone: 'muted' },
};

export const HR_SOURCE_LABELS: Record<HrBatchSource, string> = {
  PUSH: 'Надіслала 1С',
  ODATA_MANUAL: 'Отримано вручну',
  ODATA_SCHEDULE: 'Щоденне читання',
};

export const HR_ACTION_TEXT: Record<
  HrItemAction,
  { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' | 'info' }
> = {
  CREATE: { label: 'Новий', tone: 'ok' },
  UPDATE: { label: 'Зміни', tone: 'info' },
  DISMISS: { label: 'Звільнення', tone: 'warn' },
  UNCHANGED: { label: 'Без змін', tone: 'muted' },
  SKIP: { label: 'Пропущено', tone: 'muted' },
  ERROR: { label: 'Помилка в даних', tone: 'danger' },
  CONFLICT: { label: 'Розбіжність', tone: 'danger' },
};

/** The order of the review: what needs attention first. */
export const HR_ACTION_ORDER: HrItemAction[] = [
  'CONFLICT',
  'ERROR',
  'DISMISS',
  'CREATE',
  'UPDATE',
  'SKIP',
  'UNCHANGED',
];

export const EMPTY_HR_FORM: HrSyncForm = {
  system: 'ZUP',
  mode: 'PUSH',
  frequency: 'ONCE',
  odataUrl: '',
  odataUser: '',
  odataPassword: '',
  organizationCode: '',
  scheduleEnabled: true,
  scheduleHour: 6,
  autoApply: true,
  militaryPolicy: 'FILL_EMPTY',
  importDismissed: false,
  pushAllowedIps: '',
};

/** How long a new key works; 0 — until it is revoked. */
export const HR_TOKEN_DAYS_OPTIONS = [
  { value: '365', label: 'рік' },
  { value: '180', label: 'пів року' },
  { value: '90', label: '3 місяці' },
  { value: '30', label: '30 днів' },
  { value: '0', label: 'безстроково' },
] as const;

/** The data processor for 1C (published with the web application): the object module and the form module. */
export const HR_1C_PROCESSOR_URLS = {
  object: '1c/oblik-1c-export.bsl',
  form: '1c/oblik-1c-export-form.bsl',
} as const;
