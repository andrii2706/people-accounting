import { numberIn } from '../utils/text.utils.js';

/** Ukrainian text for the standard class-validator messages when a decorator has none of its own. */
export const VALIDATION_DEFAULT_MESSAGES: Record<string, (raw: string) => string> = {
  whitelistValidation: () => 'Це поле не можна змінювати тут — оновіть сторінку й спробуйте ще раз',
  isEmail: () => 'Некоректний email — приклад: name@company.ua',
  isIn: () => 'Оберіть значення зі списку',
  isUuid: () => 'Запис не знайдено — оберіть зі списку ще раз',
  isInt: () => 'Вкажіть ціле число',
  isNumber: () => 'Вкажіть число',
  min: (raw) => `Не менше ${numberIn(raw)}`,
  max: (raw) => `Не більше ${numberIn(raw)}`,
  isString: () => 'Очікується текст',
  isBoolean: () => 'Оберіть «так» або «ні»',
  isArray: () => 'Очікується список',
  arrayMaxSize: (raw) => `Не більше ${numberIn(raw)} записів`,
  arrayMinSize: (raw) => `Потрібно щонайменше ${numberIn(raw)}`,
  maxLength: (raw) => `Не більше ${numberIn(raw)} символів`,
  minLength: (raw) => `Щонайменше ${numberIn(raw)} символів`,
  matches: () => 'Некоректний формат',
  isNotEmpty: () => 'Заповніть поле',
  isDefined: () => 'Заповніть поле',
  nestedValidation: () => 'Перевірте вкладені дані',
};
