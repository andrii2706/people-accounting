/** A letter ready to send: subject, plain text and (optionally) HTML. */
export interface MailLetter {
  subject: string;
  text: string;
  html?: string;
}

/** What the caller knows about a temporary password to send (the rest is filled by the service). */
/** NEW — an account by an administrator; RESET — a new temporary password; SIGNUP — signed up himself. */
export type AccessLetterKind = 'NEW' | 'RESET' | 'SIGNUP';

export interface TemporaryPasswordMail {
  email: string;
  fullName: string;
  role: string;
  temporaryPassword: string;
  expiresAt: Date;
  kind: AccessLetterKind;
  issuedBy: { fullName: string; email: string };
  entityName?: string;
  entityCode?: string;
  asWhom?: string;
}

/** Data of the letter with a temporary password. */
export interface AccessLetterInput {
  /** Who gets access — signature form «Ольга ОБЛІКОВА». */
  fullName: string;
  /** Vocative for the greeting («Ольго»); empty — the full name is used. */
  greetingName: string;
  login: string;
  temporaryPassword: string;
  expiresAt: Date;
  /** «Кадровик» / «Директор» / «Адміністратор» and what the role can do. */
  roleLabel: string;
  roleHint: string;
  /** NEW — access given; RESET — the administrator reset the password. */
  kind: AccessLetterKind;
  /** «відповідальній особі за військовий облік» / «керівнику»; empty — no legal entity context. */
  asWhom: string;
  /** The legal entity («ТОВ «Приклад»») and its code; empty — the system in general. */
  entityName: string;
  entityCode: string;
  /** The administrator who gave the access — contact for questions. */
  adminName: string;
  adminEmail: string;
  appUrl: string;
}

/** One row of the info box of a letter: a label and an already escaped HTML value. */
export interface LetterBoxRow {
  label: string;
  html: string;
  /** Monospace value in a frame (a password). */
  mono?: boolean;
  /** Orange note under the value (validity), HTML. */
  note?: string;
}

/** Content of an account letter for the common layout (HTML parts are escaped by the caller). */
export interface LetterLayout {
  subject: string;
  entityName: string;
  greeting: string;
  paragraphs: string[];
  box?: { title: string; rows: LetterBoxRow[] };
  button?: { label: string; url: string; note?: string };
  stepsTitle?: string;
  steps?: string[];
  warning: string;
  footer: string[];
}

/** «Your password expires soon» — with a link to set a new one. */
export interface PasswordExpiringLetterInput {
  fullName: string;
  greetingName: string;
  login: string;
  expiresAt: Date;
  link: string;
  linkExpiresAt: Date;
  appUrl: string;
  entityName: string;
  entityCode: string;
}

/** The administrator asks to change the password — a link to set a new one. */
export interface PasswordChangeLetterInput {
  fullName: string;
  greetingName: string;
  login: string;
  link: string;
  linkExpiresAt: Date;
  adminName: string;
  adminEmail: string;
  appUrl: string;
  entityName: string;
  entityCode: string;
}

/** A link to set a new password for one user. */
export interface PasswordLinkMail {
  userId: string;
  email: string;
  fullName: string;
  link: string;
  linkExpiresAt: Date;
}
