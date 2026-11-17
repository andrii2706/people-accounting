import * as shevchenko from 'shevchenko';
import type { PersonName } from '../shared/interfaces/document.interface.js';
import { ADDRESS_PREFIX, NOT_A_GIVEN_NAME, PATRONYMIC, SURNAME, UKRAINIAN_WORD } from './name-declension.constants.js';

/** Full name in the genitive case («працівника Шевченка Тараса Григоровича»). Does not fail if the library cannot decline it. */
export async function inGenitive(name: PersonName): Promise<string> {
  try {
    const r = await shevchenko.inGenitive({
      gender: name.gender === 'F' ? shevchenko.GrammaticalGender.FEMININE : shevchenko.GrammaticalGender.MASCULINE,
      familyName: name.lastName,
      givenName: name.firstName,
      patronymicName: name.middleName || undefined,
    });
    return [r.familyName, r.givenName, r.patronymicName].filter(Boolean).join(' ');
  } catch {
    return [name.lastName, name.firstName, name.middleName].filter(Boolean).join(' ');
  }
}

/**
 * The given name inside a full name typed by hand: «Галина Петренко», «Петренко Галина Іванівна»,
 * «ПЕТРЕНКО Галина», «Галина ПЕТРЕНКО». The token before a patronymic; otherwise the first one that is not
 * written in capitals (a surname) and does not look like a surname; '' when nothing fits.
 */
export function givenNameOf(fullName: string): string {
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.,;]+$/, ''))
    .filter((t) => t.length > 1);
  const patronymic = tokens.findIndex((t, i) => i > 0 && PATRONYMIC.test(t));
  const given =
    patronymic > 0 ? tokens[patronymic - 1] : tokens.filter((t) => t !== t.toUpperCase()).find((t) => !SURNAME.test(t));
  return given && UKRAINIAN_WORD.test(given) && !NOT_A_GIVEN_NAME.test(given) ? given : '';
}

/** «Галина Петренко» → «Галино» (the given name in the vocative); '' if it cannot be declined. */
export async function vocativeGivenName(fullName: string): Promise<string> {
  const given = givenNameOf(fullName);
  if (!given) return '';
  try {
    const gender = await shevchenko.detectGender({ givenName: given });
    if (!gender) return '';
    return (await shevchenko.inVocative({ gender, givenName: given })).givenName ?? '';
  } catch {
    return '';
  }
}

/** How a letter or a screen addresses the person: «п. Галино»; '' — then only «Добрий день!». */
export async function addressOf(fullName: string): Promise<string> {
  const vocative = await vocativeGivenName(fullName);
  return vocative ? `${ADDRESS_PREFIX} ${vocative}` : '';
}
