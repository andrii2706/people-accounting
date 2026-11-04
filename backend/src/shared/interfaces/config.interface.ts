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
  /** Mailbox for the letters with a temporary password (falls back to smtpUrl / mailFrom). */
  accessSmtpUrl: string;
  accessMailFrom: string;
  /** How long a temporary password is valid, hours. */
  temporaryPasswordHours: number;
  /** Public address of the app for links in e-mails. */
  appUrl: string;
  /** Where the daily job looks for the presidential decrees on mobilization. */
  decreeSourceUrl: string;
  /** ЄДР lookup URL with {code}; empty — lookup off. */
  companyRegistryUrl: string;
}
