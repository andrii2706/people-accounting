import * as shevchenko from 'shevchenko';
import type { PersonName } from '../shared/interfaces/document.interface.js';

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

/** «Ольга ОБЛІКОВА» → «Ольго» (the given name in the vocative for a greeting); '' if it cannot be declined. */
export async function vocativeGivenName(fullName: string): Promise<string> {
  const given = fullName.trim().split(/\s+/)[0] ?? '';
  if (!given || given === given.toUpperCase()) return '';
  try {
    const gender = await shevchenko.detectGender({ givenName: given });
    if (!gender) return '';
    return (await shevchenko.inVocative({ gender, givenName: given })).givenName ?? '';
  } catch {
    return '';
  }
}
