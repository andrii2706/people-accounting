import * as shevchenko from 'shevchenko';

export interface PersonName {
  lastName: string;
  firstName: string;
  middleName?: string;
  gender: 'M' | 'F';
}

/** ПІБ у родовому відмінку («працівника Шевченка Тараса Григоровича»). Без падіння, якщо бібліотека не впоралась. */
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
