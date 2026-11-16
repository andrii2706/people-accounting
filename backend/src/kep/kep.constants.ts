/** The answer when a KEP check is needed but KEP_VERIFIER is not set. */
export const KEP_NOT_CONFIGURED = 'KEP_NOT_CONFIGURED';
export const KEP_NOT_CONFIGURED_MESSAGE =
  'Перевірку кваліфікованого електронного підпису ще не налаштовано. Зверніться до постачальника.';

/** Apostrophes and dashes people and providers write differently. */
export const NAME_APOSTROPHES = /[’ʼ'`‘ʹ′]/g;

/** Latin letters that look like Cyrillic ones — in the certificates of some providers. */
export const LATIN_LOOKALIKES: Record<string, string> = {
  A: 'А',
  B: 'В',
  C: 'С',
  E: 'Е',
  H: 'Н',
  I: 'І',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  T: 'Т',
  X: 'Х',
};

/** The certificates of the qualified trust service providers (ЦЗО) — the trust anchors of KEP_VERIFIER=dstu. */
export const KEP_CA_URL_DEFAULT = 'https://czo.gov.ua/download/certificates/CACertificates.p7b';
/** The list is fetched again after this many hours (new providers, renewed certificates). */
export const KEP_CA_REFRESH_HOURS = 24;
/** How long to wait for czo.gov.ua and for the OCSP of a provider. */
export const KEP_FETCH_TIMEOUT_MS = 15_000;

/** Why a signature was refused (KEP_VERIFIER=dstu) — shown to the user as is. */
export const DSTU_ERRORS = {
  notSigned: 'Це не файл підпису (.p7s) — оберіть файл, який створила програма підпису',
  oneSigner: 'Потрібен рівно один підпис — керівника',
  noCert:
    'У файлі підпису немає сертифіката підписувача — під час підписання увімкніть «додавати сертифікат до підпису»',
  otherDocument: 'Підписано інший документ — підпишіть саме файл заяви, сформований на цій сторінці',
  badSignature: 'Підпис не відповідає документу — підпишіть саме файл заяви без змін',
  notQualified:
    'Сертифікат підписувача не видано кваліфікованим надавачем, він недійсний на дату підпису або не призначений для підпису',
  revoked: 'Сертифікат підписувача відкликано або заблоковано — підпишіть чинним ключем',
  ocspUnavailable:
    'Надавач зараз не підтверджує чинність сертифіката (OCSP не відповідає) — спробуйте за кілька хвилин',
  unsupported:
    'Не вдалося перевірити підпис. Підтримуються ключі ДСТУ 4145 (Дія.Підпис, ПриватБанк, податкова та інші кваліфіковані надавачі)',
  noCaList: 'Перелік кваліфікованих надавачів зараз недоступний — спробуйте за кілька хвилин',
} as const;
