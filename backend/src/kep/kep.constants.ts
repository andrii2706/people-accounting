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
