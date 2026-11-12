import type { SelectOption } from '../interfaces/ui.interface';
import type {
  DatabaseCheckStatus,
  DbSslMode,
  EntityDatabaseForm,
} from '../interfaces/entity-database.interface';

export const DB_SSL_OPTIONS: SelectOption<DbSslMode>[] = [
  { value: 'require', label: 'TLS (сертифікат не перевіряється)' },
  { value: 'verify-full', label: 'TLS з перевіркою сертифіката' },
  { value: 'disable', label: 'Без шифрування — лише для розробки' },
];

/** The same lower bound as on the server: system ports are not accepted. */
export const DB_MIN_PORT = 1024;
export const DB_MAX_PORT = 65535;

export const EMPTY_DATABASE_FORM: EntityDatabaseForm = {
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
  sslMode: 'verify-full',
};

export const DB_STATUS_LABELS: Record<DatabaseCheckStatus, string> = {
  NEW: 'Збережено, ще не перевірено',
  OK: 'Підключення працює',
  ERROR: 'Остання перевірка — помилка',
};

/** The same rules as on the server (EntityDatabaseDto). */
export const DB_PATTERN = {
  host: /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$|^[0-9a-fA-F:.]+$/,
  database: /^[A-Za-z0-9_$-]{1,63}$/,
  username: /^[A-Za-z0-9_.@$-]{1,63}$/,
};

export const DB_MESSAGE = {
  host: 'Адреса сервера — ім’я (db.company.ua) або IP, без http:// і шляху',
  database: 'Назва бази — латиниця, цифри, _ або -, до 63 символів',
  username: 'Користувач — латиниця, цифри, _ . @ або -, до 63 символів',
};
