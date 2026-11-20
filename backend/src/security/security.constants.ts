import type { SecurityEventKind, SecurityPolicy } from '../shared/interfaces/security.interface.js';

/** Who is told about what, and how often. */
export const SECURITY_POLICIES: Record<SecurityEventKind, SecurityPolicy> = {
  LOGIN_LOCKED: { level: 'WARN', toUser: true, toManagers: true, quietMinutes: 60, merge: true },
  LOGIN_BURST: { level: 'CRITICAL', toUser: false, toManagers: true, quietMinutes: 60, merge: true },
  NEW_DEVICE: { level: 'INFO', toUser: true, toManagers: false, quietMinutes: 0, merge: false },
  MFA_LOCKED: { level: 'CRITICAL', toUser: true, toManagers: true, quietMinutes: 60, merge: false },
  MFA_ENABLED: { level: 'INFO', toUser: true, toManagers: false, quietMinutes: 0, merge: false },
  MFA_DISABLED: { level: 'WARN', toUser: true, toManagers: true, quietMinutes: 0, merge: false },
  MFA_RESET: { level: 'WARN', toUser: true, toManagers: true, quietMinutes: 0, merge: false },
  MFA_RECOVERY_USED: { level: 'WARN', toUser: true, toManagers: false, quietMinutes: 0, merge: false },
  MFA_CODES_RENEWED: { level: 'INFO', toUser: true, toManagers: false, quietMinutes: 0, merge: false },
  EXPORT_LIMIT: { level: 'CRITICAL', toUser: false, toManagers: true, quietMinutes: 60, merge: true },
  MASS_VIEW: { level: 'WARN', toUser: false, toManagers: true, quietMinutes: 60, merge: true },
  UPLOAD_BLOCKED: { level: 'CRITICAL', toUser: false, toManagers: true, quietMinutes: 30, merge: false },
  HR_PUSH_DENIED: { level: 'WARN', toUser: false, toManagers: true, quietMinutes: 60, merge: true },
};

/** The line in the journal and the subject of the letter. */
export const SECURITY_TITLES: Record<SecurityEventKind, string> = {
  LOGIN_LOCKED: 'Вхід заблоковано після невдалих спроб',
  LOGIN_BURST: 'Підбір паролів з однієї адреси',
  NEW_DEVICE: 'Вхід з нового пристрою',
  MFA_LOCKED: 'Правильний пароль, але неправильні коди',
  MFA_ENABLED: 'Увімкнено вхід з кодом',
  MFA_DISABLED: 'Вимкнено вхід з кодом',
  MFA_RESET: 'Адміністратор скинув вхід з кодом',
  MFA_RECOVERY_USED: 'Вхід за резервним кодом',
  MFA_CODES_RENEWED: 'Створено нові резервні коди',
  EXPORT_LIMIT: 'Досягнуто ліміту вивантажень',
  MASS_VIEW: 'Переглянуто дуже багато карток',
  UPLOAD_BLOCKED: 'Заблоковано небезпечний файл',
  HR_PUSH_DENIED: 'Відхилено надсилання з 1С',
};

/** What the person should do — the last paragraph of the letter. */
export const SECURITY_ADVICE: Partial<Record<SecurityEventKind, string>> = {
  LOGIN_LOCKED:
    'Якщо це були не ви — хтось намагається підібрати ваш пароль. Після розблокування змініть пароль (Профіль → «Змінити пароль»).',
  LOGIN_BURST:
    'З однієї адреси намагаються увійти в різні облікові записи. Якщо адреса не ваша, заблокуйте її у фаєрволі (Cloud Armor), див. docs/SECURITY.md.',
  NEW_DEVICE: 'Якщо це були ви — нічого робити не треба. Якщо ні — негайно змініть пароль і повідомте адміністратора.',
  MFA_LOCKED:
    'Хтось увів правильний пароль, але не зміг пройти другий крок. Пароль, найімовірніше, відомий стороннім — змініть його одразу після розблокування.',
  MFA_DISABLED: 'Якщо це зробили не ви — увімкніть вхід з кодом знову й змініть пароль.',
  MFA_RESET: 'Під час наступного входу знадобиться знову налаштувати застосунок для кодів.',
  MFA_RECOVERY_USED:
    'Кожен резервний код діє один раз. Якщо телефон загубився — у профілі створіть нові коди й налаштуйте застосунок на новому телефоні.',
  EXPORT_LIMIT:
    'Обліковий запис вивантажує файли швидше, ніж зазвичай. Перевірте в «Журналі безпеки», чи це законна робота; якщо ні — заблокуйте користувача.',
  MASS_VIEW: 'Обліковий запис переглядає картки швидше, ніж зазвичай буває в роботі. Перевірте, чи це законна робота.',
  UPLOAD_BLOCKED:
    'Файл містив макрос, скрипт або програму й не був прийнятий. Перевірте комп’ютер, з якого його завантажили, антивірусом.',
  HR_PUSH_DENIED: 'Якщо адреса чужа — відкличте ключ 1С і видайте новий (Налаштування → юрособа → «Інтеграція з 1С»).',
};

/** Password guessing across accounts: so many failures from one address within the window… */
export const LOGIN_BURST_FAILURES = 20;
export const LOGIN_BURST_WINDOW_MINUTES = 10;
/** …into at least so many different e-mails (one person mistyping his own password is not a burst). */
export const LOGIN_BURST_ACCOUNTS = 3;

/** The device cookie lives long: a new device is the one the person has never signed in from. */
export const DEVICE_COOKIE_DAYS = 400;

/** How long the journal and the download records are kept. */
export const SECURITY_KEEP_DAYS = 365;

/** The page of the journal. */
export const SECURITY_PAGE_SIZE = 50;
export const SECURITY_PAGE_MAX = 200;

/** Downloads: the message when the limit is reached. */
export const EXPORT_LIMIT_MESSAGE =
  'Досягнуто ліміту вивантажень ({limit} файлів за {period}). Спробуйте пізніше або зверніться до адміністратора.';

/** A file whose bytes must not change (the document under the e-signature, the signature itself). */
export const KEEP_FILE_INTACT = 'keepFileIntact';
