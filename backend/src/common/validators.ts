import { BadRequestException } from '@nestjs/common';
import { registerDecorator, type ValidationError, type ValidationOptions } from 'class-validator';
import { isIsoDate, todayIso } from './utils/dates.js';

const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

/** Рядок дати `YYYY-MM-DD` (порожній рядок / null дозволені при nullable). */
export function IsIsoDate(opts: { nullable?: boolean } = {}, validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, key: string | symbol) => {
    const propertyName = String(key);
    registerDecorator({
      name: 'isIsoDate',
      target: object.constructor,
      propertyName,
      options: { message: 'Некоректна дата (очікується РРРР-ММ-ДД)', ...validationOptions },
      validator: {
        validate(value: unknown) {
          if (opts.nullable && (value === null || value === '')) return true;
          if (!isIsoDate(value)) return false;
          return !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && value >= '1900-01-01' && value <= '2100-12-31';
        },
      },
    });
  };
}

let ruleSeq = 0;

/**
 * Довільне правило з українським повідомленням. Порожні значення пропускаються
 * (обов’язковість перевіряється окремо). check отримує значення і весь об’єкт DTO —
 * для правил, що залежать від інших полів (напр. тип паспорта).
 */
export function Rule<T = string>(check: (value: T, dto: Record<string, unknown>) => boolean, message: string): PropertyDecorator {
  const name = `rule${++ruleSeq}`;
  return (object: object, key: string | symbol) => {
    registerDecorator({
      name,
      target: object.constructor,
      propertyName: String(key),
      options: { message },
      validator: {
        validate(value: unknown, args) {
          if (isEmpty(value)) return true;
          return check(value as T, args?.object as Record<string, unknown>);
        },
      },
    });
  };
}

export const NotFuture = () => Rule((v: string) => v <= todayIso(), 'Дата не може бути в майбутньому');

// ---------------------------------------------------------------- відповідь з помилками

/** Переклад стандартних повідомлень class-validator, якщо декоратор не задав свого. */
const DEFAULT_MESSAGES: Record<string, string> = {
  whitelistValidation: 'Невідоме поле',
  isEmail: 'Некоректний email',
  isIn: 'Недопустиме значення',
  isUuid: 'Некоректний ідентифікатор',
  isInt: 'Очікується ціле число',
  min: 'Значення замале',
  max: 'Значення завелике',
  isString: 'Очікується текст',
  isBoolean: 'Очікується так/ні',
  isArray: 'Очікується список',
  maxLength: 'Задовге значення',
  minLength: 'Закоротке значення',
  matches: 'Некоректний формат',
  isNotEmpty: 'Обов’язкове поле',
  nestedValidation: 'Некоректні вкладені дані',
};

const hasCyrillic = (s: string) => /[а-яіїєґ]/i.test(s);

export interface FieldError {
  /** Шлях до поля: "passportSeries", "familyMembers.0.lastName", "changeMeta.basis". */
  field: string;
  message: string;
}

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  const out: FieldError[] = [];
  for (const e of errors) {
    const field = parent ? `${parent}.${e.property}` : e.property;
    for (const [constraint, raw] of Object.entries(e.constraints ?? {})) {
      out.push({ field, message: hasCyrillic(raw) ? raw : (DEFAULT_MESSAGES[constraint] ?? raw) });
    }
    if (e.children?.length) out.push(...flattenValidationErrors(e.children, field));
  }
  return out;
}

/**
 * Для ValidationPipe: 400 з `message` (рядки для показу) та `errors` (прив’язка до полів —
 * фронтенд показує помилку під потрібним полем і перемикає вкладку).
 */
export function validationExceptionFactory(errors: ValidationError[]) {
  const list = flattenValidationErrors(errors);
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: list.map((e) => `${e.field}: ${e.message}`),
    errors: list,
  });
}
