import type { SignupRejectReason } from '../shared/interfaces/signup.interface.js';

/** How long the statement may be signed — then a new one is needed. */
export const SIGNUP_STATEMENT_MINUTES = 30;

export const SIGNUP_REJECTED = 'SIGNUP_REJECTED';
export const SIGNUP_REJECTED_MESSAGE =
  'Реєстрацію не підтверджено: підписант не є керівником цієї юридичної особи за даними ЄДР або підпис недійсний. ' +
  'Якщо це помилка — зверніться до постачальника.';

/** What the administrator sees. */
export const SIGNUP_REASON_LABELS: Record<SignupRejectReason, string> = {
  SIGNATURE_INVALID: 'Підпис недійсний',
  CERT_EDRPOU_MISMATCH: 'У сертифікаті інший код ЄДРПОУ',
  NOT_IN_REGISTRY: 'Код не знайдено в ЄДР',
  TERMINATED: 'Юрособа припинена за ЄДР',
  NOT_HEAD: 'Підписант — не керівник за ЄДР',
  ENTITY_EXISTS: 'Юрособа вже зареєстрована',
};

export const SIGNUP_ALERT_SUBJECT = 'Спроба реєстрації юрособи неуповноваженою особою';

/** The position of the head when the register does not state it. */
export const DEFAULT_HEAD_POSITION = 'Керівник';

/** The file name the director downloads and signs. */
export const statementFileName = (edrpou: string) => `zayava-reiestratsiia-${edrpou}.txt`;
