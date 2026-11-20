import type { SecurityEventKind, SecurityLevel } from '../interfaces/security.interface';

/** The filter of the journal: the groups a person thinks in. */
export const SECURITY_KIND_GROUPS: { label: string; kinds: SecurityEventKind[] }[] = [
  { label: 'Вхід', kinds: ['LOGIN_LOCKED', 'LOGIN_BURST', 'NEW_DEVICE', 'MFA_LOCKED'] },
  {
    label: 'Вхід з кодом',
    kinds: ['MFA_ENABLED', 'MFA_DISABLED', 'MFA_RESET', 'MFA_RECOVERY_USED', 'MFA_CODES_RENEWED'],
  },
  { label: 'Дані', kinds: ['EXPORT_LIMIT', 'MASS_VIEW', 'UPLOAD_BLOCKED', 'HR_PUSH_DENIED'] },
];

export const SECURITY_KIND_TEXT: Record<SecurityEventKind, string> = {
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

export const SECURITY_LEVEL_TEXT: Record<SecurityLevel, string> = {
  INFO: 'До відома',
  WARN: 'Увага',
  CRITICAL: 'Небезпечно',
};

export const SECURITY_LEVEL_CLASS: Record<SecurityLevel, string> = {
  INFO: 'bg-sunken text-muted',
  WARN: 'bg-[#fdf9f2] text-warning',
  CRITICAL: 'bg-[#fdf1ef] text-danger',
};

/** The words of the details of an event. */
export const SECURITY_DETAIL_LABELS: Record<string, string> = {
  failures: 'спроб',
  accounts: 'облікових записів',
  minutes: 'за хвилин',
  limit: 'ліміт',
  period: 'за',
  count: 'карток',
  file: 'файл',
  reason: 'причина',
  by: 'хто',
  left: 'залишилось кодів',
  repeats: 'повторів',
};

/** Why a file was refused — in words. */
export const UPLOAD_REASON_TEXT: Record<string, string> = {
  EXECUTABLE: 'програма',
  MACRO: 'макроси',
  SCRIPT: 'скрипт',
  EMBEDDED_OBJECT: 'вбудований об’єкт',
  EXTERNAL_LINK: 'зовнішнє посилання',
  DDE: 'поле DDE',
  FORMULA: 'небезпечна формула',
  ARCHIVE_BOMB: 'архів-бомба',
  PATH_TRAVERSAL: 'шляхи за межі файлу',
};

export const SECURITY_PAGE_SIZE = 50;

/** Authenticator apps people already have or can install. */
export const AUTHENTICATOR_APPS = [
  'Google Authenticator',
  'Microsoft Authenticator',
  '1Password',
  'Bitwarden',
];
