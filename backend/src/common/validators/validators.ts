import { BadRequestException } from '@nestjs/common';
import { registerDecorator, type ValidationError, type ValidationOptions } from 'class-validator';
import { isIsoDate, todayIso } from '../utils/dates.utils.js';
import type { FieldError, IsoDateOptions } from '../../shared/interfaces/common.interface.js';
import { fieldLabel } from '../utils/field-labels.utils.js';
import { VALIDATION_DEFAULT_MESSAGES } from '../constants/validation.constants.js';
import { hasCyrillic } from '../utils/text.utils.js';
import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MESSAGE } from '../../military/employee-rules.js';

const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

/** Date string `YYYY-MM-DD` (empty string / null allowed when nullable). */
export function IsIsoDate(opts: IsoDateOptions = {}, validationOptions?: ValidationOptions): PropertyDecorator {
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
 * Custom rule with a Ukrainian message. Empty values are skipped
 * (required-ness is checked separately). `check` receives the value and the whole DTO —
 * for rules that depend on other fields (e.g. passport type).
 */
export function Rule<T = string>(
  check: (value: T, dto: Record<string, unknown>) => boolean,
  message: string | ((value: T) => string),
): PropertyDecorator {
  const name = `rule${++ruleSeq}`;
  return (object: object, key: string | symbol) => {
    registerDecorator({
      name,
      target: object.constructor,
      propertyName: String(key),
      options: { message: typeof message === 'string' ? message : (args) => message(args.value as T) },
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

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  const out: FieldError[] = [];
  for (const e of errors) {
    const field = parent ? `${parent}.${e.property}` : e.property;
    for (const [constraint, raw] of Object.entries(e.constraints ?? {})) {
      const translate = VALIDATION_DEFAULT_MESSAGES[constraint];
      out.push({ field, message: hasCyrillic(raw) ? raw : translate ? translate(raw) : 'Некоректне значення' });
    }
    if (e.children?.length) out.push(...flattenValidationErrors(e.children, field));
  }
  return out;
}

/** «Телефон: Некоректний формат» — readable lines for a toast when the form cannot show them at the fields. */
function readable(list: FieldError[], request?: string): string[] {
  return list.map((e) => `${fieldLabel(e.field, request)}: ${e.message}`);
}

/** Adds the human name of the field — the frontend shows «Телефон: …» when the field is not on the screen. */
function labelled(list: FieldError[], request?: string): FieldError[] {
  return list.map((e) => ({ ...e, label: fieldLabel(e.field, request) }));
}

/** The same 400 as the ValidationPipe — for rules checked in services on the merged entity. */
export function fieldErrors(list: FieldError[]) {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: readable(list),
    errors: labelled(list),
  });
}

/**
 * For ValidationPipe: 400 with `message` (strings to display) and `errors` (bound to fields —
 * the frontend shows the error under the right field and switches to its tab).
 */
export function validationExceptionFactory(errors: ValidationError[]) {
  const list = flattenValidationErrors(errors);
  // the request class picks the labels: «fullName» is «Повна назва» of a company, «ПІБ» of a user
  const request = (errors[0]?.target as object | undefined)?.constructor?.name;
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: readable(list, request),
    errors: labelled(list, request),
  });
}

/** Optional ISO date (empty / null allowed). */
export const DateField = () => applyDecorators(IsOptional(), IsIsoDate({ nullable: true }));

/** Optional ISO date that is not in the future. */
export const PastDate = () => applyDecorators(DateField(), NotFuture());

/** A regular expression rule with a Ukrainian message. */
export const Pattern = (re: RegExp, message: string) => Rule((v: string) => re.test(v), message);

/** Optional string of at most `max` characters. */
export const OptionalStr = (max: number) =>
  applyDecorators(IsOptional(), IsString(), MaxLength(max, { message: MESSAGE.tooLong(max) }));
