import * as shevchenko from 'shevchenko';

export interface PersonName {
  lastName: string;
  firstName: string;
  middleName?: string;
  gender: 'M' | 'F';
}

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
