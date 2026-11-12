import { LATIN_LOOKALIKES, NAME_APOSTROPHES } from '../kep.constants.js';
import type { SignerCertificate } from '../../shared/interfaces/signature.interface.js';

/** «Петренко  Іван-Іванович» → ['ПЕТРЕНКО', 'ІВАН-ІВАНОВИЧ']: upper case, one apostrophe, Cyrillic letters. */
export function nameTokens(name: string): string[] {
  return name
    .normalize('NFC')
    .replace(NAME_APOSTROPHES, "'")
    .replace(/[–—‑]/g, '-')
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => LATIN_LOOKALIKES[c] ?? c)
    .replace(/Ё/g, 'Е')
    .split(/[\s,]+/)
    .map((t) => t.replace(/^[-.']+|[-.']+$/g, ''))
    .filter(Boolean);
}

/**
 * The same person: surname, name and — when both sides have it — patronymic coincide.
 * The ЄДР states «ПРІЗВИЩЕ ІМ'Я ПО БАТЬКОВІ», the certificate — the same or without the patronymic.
 */
export function samePerson(a: string, b: string): boolean {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (x.length < 2 || y.length < 2) return false;
  if (x[0] !== y[0] || x[1] !== y[1]) return false;
  return x.length < 3 || y.length < 3 || x.slice(2).join(' ') === y.slice(2).join(' ');
}

/** The full name in a certificate: the commonName or «surname + givenName» (the givenName holds the patronymic). */
export function certificateFullName(c: Pick<SignerCertificate, 'commonName' | 'surname' | 'givenName'>): string {
  if (c.surname && c.givenName) return `${c.surname} ${c.givenName}`;
  return c.commonName;
}

/** «Іван ПЕТРЕНКО» (the form in the documents) matches a full name: the name and the surname. */
export function matchesSignatureName(fullName: string, signatureName: string): boolean {
  const full = nameTokens(fullName);
  const sig = nameTokens(signatureName);
  if (full.length < 2 || sig.length !== 2) return false;
  return full[0] === sig[1] && full[1] === sig[0];
}
