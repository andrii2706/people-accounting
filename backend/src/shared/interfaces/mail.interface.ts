/** A letter ready to send: subject, plain text and (optionally) HTML. */
export interface MailLetter {
  subject: string;
  text: string;
  html?: string;
}

/** What the caller knows about a temporary password to send (the rest is filled by the service). */
export interface TemporaryPasswordMail {
  email: string;
  fullName: string;
  role: string;
  temporaryPassword: string;
  expiresAt: Date;
  kind: 'NEW' | 'RESET';
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
  kind: 'NEW' | 'RESET';
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
