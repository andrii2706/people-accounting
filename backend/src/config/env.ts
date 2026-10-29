/**
 * Configuration validated at startup. If something is missing the app does not start
 * and says clearly what to fix (instead of a stack trace from deep inside DI).
 */
import { createHash, hkdfSync } from 'node:crypto';

export interface AppEnv {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  dbMigrationsRun: boolean;
  dbLogging: boolean;

  jwtSecret: string;
  cookieName: string;
  cookieSecure: boolean;
  /** The session ends after N minutes of inactivity. */
  sessionIdleMinutes: number;
  /** Absolute session lifetime, even if the user is active. */
  sessionMaxHours: number;
  maxFailedLogins: number;
  lockoutMinutes: number;

  /** Allowed Origins for state-changing requests (CSRF protection). Empty — same-origin only. */
  appOrigins: string[];
  /** CORS is enabled only for local development; in production the frontend and API share one origin via the proxy. */
  corsOrigins: string[];
  /** How many proxies in front of the API to trust when determining the client IP. */
  trustProxyHops: number;
  swagger: boolean;

  /** 32 bytes for AES-256-GCM (encryption of sensitive fields). */
  dataKey: Buffer;
  /** Separate key for the "blind index" (search by RNOKPP without decryption). */
  blindIndexKey: Buffer;

  storageDriver: 'local' | 'gcs';
  storageLocalDir: string;
  storageBucket: string;

  /** Qualified e-signature: IIT eusign.js library script (own copy, e.g. /iit/eusign.js). Empty — .p7s upload only. */
  signWidgetScriptUrl: string;
  /** Qualified e-signature: URL of the IIT widget opened in a frame (e.g. https://eu.iit.com.ua/sign-widget/v20240301/). */
  signWidgetFrameUrl: string;
  /** Official signature verification service shown to the user. */
  signVerifyUrl: string;

  adminEmail?: string;
  adminPassword?: string;
  adminName: string;

  /** SMTP for e-mail reminders, e.g. smtps://user:app-password@smtp.gmail.com:465. Empty — e-mail is off. */
  smtpUrl: string;
  /** Sender: «Військовий облік <hr@company.ua>». */
  mailFrom: string;
  /** Public address of the app for links in e-mails. */
  appUrl: string;
  /** Where the daily job looks for the presidential decrees on mobilization. */
  decreeSourceUrl: string;
}

const DEFAULT_DEV_ADMIN_PASSWORD = 'ChangeMe123!';

function bool(v: string | undefined, fallback: boolean) {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function int(v: string | undefined, fallback: number) {
  const n = Number(v);
  return v === undefined || v === '' || Number.isNaN(n) ? fallback : n;
}

function list(v: string | undefined) {
  return (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function decodeKey(name: string, v: string, problems: string[]): Buffer | null {
  try {
    const buf = Buffer.from(v, 'base64');
    if (buf.length !== 32) throw new Error();
    return buf;
  } catch {
    problems.push(`${name} має бути 32 байти в base64 (згенеруйте: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")`);
    return null;
  }
}

let cached: AppEnv | null = null;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached && env === process.env) return cached;
  const problems: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl) problems.push('DATABASE_URL — рядок підключення до PostgreSQL');

  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) problems.push('JWT_SECRET — випадковий рядок щонайменше 32 символи');

  // Encryption keys: in production — only explicitly set; in development — derived from JWT_SECRET (with a warning)
  let dataKey: Buffer | null = null;
  let blindIndexKey: Buffer | null = null;
  if (env.DATA_ENCRYPTION_KEY) dataKey = decodeKey('DATA_ENCRYPTION_KEY', env.DATA_ENCRYPTION_KEY, problems);
  if (env.BLIND_INDEX_KEY) blindIndexKey = decodeKey('BLIND_INDEX_KEY', env.BLIND_INDEX_KEY, problems);
  if (!dataKey || !blindIndexKey) {
    if (isProduction) {
      if (!env.DATA_ENCRYPTION_KEY) problems.push('DATA_ENCRYPTION_KEY — обов’язковий у продакшні');
      if (!env.BLIND_INDEX_KEY) problems.push('BLIND_INDEX_KEY — обов’язковий у продакшні');
    } else if (jwtSecret) {
      const seed = createHash('sha256').update(jwtSecret).digest();
      dataKey ??= Buffer.from(hkdfSync('sha256', seed, 'military-registry', 'data-encryption', 32));
      blindIndexKey ??= Buffer.from(hkdfSync('sha256', seed, 'military-registry', 'blind-index', 32));
      warnings.push('DATA_ENCRYPTION_KEY / BLIND_INDEX_KEY не задані — використано ключі, похідні від JWT_SECRET (лише для розробки!)');
    }
  }

  const cookieSecure = bool(env.COOKIE_SECURE, isProduction);
  const cookieName = env.COOKIE_NAME ?? (cookieSecure ? '__Host-mr_session' : 'mr_session');
  if (cookieName.startsWith('__Host-') && !cookieSecure) problems.push('COOKIE_NAME з префіксом __Host- потребує COOKIE_SECURE=true');

  const storageDriver = (env.STORAGE_DRIVER ?? (isProduction ? 'gcs' : 'local')) as AppEnv['storageDriver'];
  if (!['local', 'gcs'].includes(storageDriver)) problems.push('STORAGE_DRIVER — local або gcs');
  if (storageDriver === 'gcs' && !env.STORAGE_BUCKET) problems.push('STORAGE_BUCKET — бакет Cloud Storage для підписаних документів');

  for (const key of ['SIGN_WIDGET_SCRIPT_URL', 'SIGN_WIDGET_FRAME_URL'] as const) {
    const v = env[key];
    if (v && !/^(https:\/\/|\/)/.test(v)) problems.push(`${key} — https://… або шлях від кореня сайту (/…)`);
  }
  if (!!env.SIGN_WIDGET_SCRIPT_URL !== !!env.SIGN_WIDGET_FRAME_URL) {
    problems.push('SIGN_WIDGET_SCRIPT_URL і SIGN_WIDGET_FRAME_URL задаються разом (або обидва порожні)');
  }

  if (isProduction) {
    if (!cookieSecure) problems.push('COOKIE_SECURE=true — обов’язково в продакшні (лише HTTPS)');
    if (env.ADMIN_PASSWORD === DEFAULT_DEV_ADMIN_PASSWORD) problems.push('ADMIN_PASSWORD — не можна використовувати пароль за замовчуванням у продакшні');
    if (list(env.CORS_ORIGIN).length) warnings.push('CORS_ORIGIN задано в продакшні — зазвичай не потрібен (фронт звертається через проксі)');
  }

  if (problems.length) {
    const text = ['', 'Конфігурація некоректна. Перевірте backend/.env (шаблон — .env.example):', ...problems.map((p) => `  • ${p}`), ''].join('\n');
    throw new Error(text);
  }
  for (const w of warnings) console.warn(`⚠️  ${w}`);

  const result: AppEnv = {
    nodeEnv,
    isProduction,
    port: int(env.PORT, 3000),
    databaseUrl,
    dbMigrationsRun: bool(env.DB_MIGRATIONS_RUN, !isProduction),
    dbLogging: bool(env.DB_LOGGING, false),
    jwtSecret,
    cookieName,
    cookieSecure,
    sessionIdleMinutes: int(env.SESSION_IDLE_MINUTES, 30),
    sessionMaxHours: int(env.SESSION_MAX_HOURS, 10),
    maxFailedLogins: int(env.MAX_FAILED_LOGINS, 5),
    lockoutMinutes: int(env.LOCKOUT_MINUTES, 15),
    appOrigins: list(env.APP_ORIGIN),
    corsOrigins: list(env.CORS_ORIGIN ?? (isProduction ? '' : 'http://localhost:4200')),
    trustProxyHops: int(env.TRUST_PROXY_HOPS, 0),
    swagger: bool(env.SWAGGER, !isProduction),
    dataKey: dataKey!,
    blindIndexKey: blindIndexKey!,
    storageDriver,
    storageLocalDir: env.STORAGE_LOCAL_DIR ?? 'storage/files',
    storageBucket: env.STORAGE_BUCKET ?? '',
    signWidgetScriptUrl: env.SIGN_WIDGET_SCRIPT_URL ?? '',
    signWidgetFrameUrl: env.SIGN_WIDGET_FRAME_URL ?? '',
    signVerifyUrl: env.SIGN_VERIFY_URL ?? 'https://czo.gov.ua/verify',
    adminEmail: env.ADMIN_EMAIL || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
    adminName: env.ADMIN_NAME ?? 'Адміністратор',
    smtpUrl: env.SMTP_URL ?? '',
    mailFrom: env.MAIL_FROM ?? '',
    appUrl: env.APP_URL || list(env.APP_ORIGIN)[0] || 'http://localhost:4200',
    decreeSourceUrl: env.DECREE_SOURCE_URL || 'https://zakon.rada.gov.ua/laws/show/65/2022',
  };
  if (env === process.env) cached = result;
  return result;
}

/** For ConfigModule.forRoot({ validate }) — fails with a clear message. */
export function validateEnv(raw: Record<string, unknown>) {
  loadEnv(raw as NodeJS.ProcessEnv);
  return raw;
}
