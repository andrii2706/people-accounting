/**
 * Текстові представлення полів працівника для документів і списків.
 * Відтворюють формули CONCATENATE з картки працівника (колонки FM–GE) та аркуша «список».
 */
import { formatUa } from '../common/utils/dates.js';
import type { Employee } from '../employees/entities/employee.entity.js';
import { FAMILY_RELATION_LABELS, maritalStatusLabel } from './dictionaries.js';
import { compositionText, isConscript, isOfficer, isReservist } from './military-logic.js';
import { rankTitle } from './ranks.js';

type E = Pick<Employee, keyof Employee>;

const join = (parts: Array<string | null | undefined | false>, sep = ', ') =>
  parts.filter((p): p is string => !!p && !!p.trim()).join(sep);

export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function fullName(e: Pick<E, 'lastName' | 'firstName' | 'middleName'>): string {
  return join([e.lastName, e.firstName, e.middleName], ' ');
}

export function rankText(e: Pick<E, 'rankCode' | 'navy'>): string {
  return rankTitle(e.rankCode, e.navy);
}

/** Колонка 5: реєстраційний номер ЄДР / РНОКПП. */
export function registryText(e: E): string {
  return join([e.registryNumber, e.rnokpp], ' / ');
}

export function militaryDocText(e: E, withIssuer = true): string {
  if (!e.militaryDocType && !e.militaryDocNumber) return '';
  const generated = e.militaryDocGeneratedAt ? `, час та дата формування ${e.militaryDocGeneratedAt}` : '';
  return join(
    [
      join([
        e.militaryDocType,
        e.militaryDocSeries ? `серія ${e.militaryDocSeries.toUpperCase()}` : '',
        e.militaryDocNumber ? `№ ${e.militaryDocNumber.toUpperCase()}` : '',
      ], ' '),
      e.militaryDocIssuedAt ? `виданий ${formatUa(e.militaryDocIssuedAt)} р.` : '',
      withIssuer ? e.militaryDocIssuedBy : '',
    ],
    ', ',
  ) + generated;
}

/** Колонка 8: категорія обліку (для офіцерів розряд), військово-обліковий документ. */
export function categoryAndDocText(e: E): string {
  const doc = join(
    [
      e.militaryDocType,
      e.militaryDocSeries ? `серія ${e.militaryDocSeries.toUpperCase()}` : '',
      e.militaryDocNumber ? `№ ${e.militaryDocNumber.toUpperCase()}` : '',
    ],
    ' ',
  );
  if (isConscript(e)) return doc;
  const cat = e.accountingCategory ? (isOfficer(e) ? `розряд - ${e.accountingCategory}` : `категорія - ${e.accountingCategory}`) : '';
  return join([cat, doc]);
}

export function passportText(e: E): string {
  if (!e.passportNumber) return '';
  const kind = e.passportType === 'ID_CARD' ? 'паспорт громадянина України (ID-картка)' : 'паспорт громадянина України';
  return join([
    join([kind, e.passportSeries ? `серія ${e.passportSeries.toUpperCase()}` : '', `№ ${e.passportNumber}`], ' '),
    e.passportIssuedAt ? `виданий ${formatUa(e.passportIssuedAt)} р.` : '',
    e.passportIssuedBy,
  ]);
}

export function foreignPassportText(e: E): string {
  if (!e.foreignPassportNumber) return '';
  return join([
    join(['паспорт для виїзду за кордон', e.foreignPassportSeries ? `серія ${e.foreignPassportSeries.toUpperCase()}` : '', `№ ${e.foreignPassportNumber}`], ' '),
    e.foreignPassportIssuedAt ? `виданий ${formatUa(e.foreignPassportIssuedAt)} р.` : '',
    e.foreignPassportIssuedBy,
    e.foreignPassportValidUntil ? `дійсний до ${formatUa(e.foreignPassportValidUntil)} р.` : '',
  ]);
}

/** Колонка 10: обидва паспорти. */
export function passportsText(e: E): string {
  return join([passportText(e), foreignPassportText(e)], '; ');
}

/** Колонка 9: освіта. */
export function educationText(e: E): string {
  return join([
    e.educationLevel,
    e.educationSpecialty ? `спеціальність «${e.educationSpecialty}»` : '',
    e.educationDocument,
    e.educationDocumentDate ? `від ${formatUa(e.educationDocumentDate)} р.` : '',
  ]);
}

export function actualAddressText(e: E): string {
  return e.actualAddress || e.registeredAddress;
}

/** Колонка 13: ТЦК. */
export function tckText(e: E): string {
  return e.tck?.name ?? '';
}

/** Колонка 14: спецоблік / номер команди / служба в резерві (формула GA2). */
export function specialAccountingText(e: E): string {
  if (isReservist(e)) return `${e.reserveTeamNumber} Р`;
  if (isConscript(e)) return e.deferralConscriptionBasis;
  const reservation = e.reservationBasis
    ? join([e.reservationBasis, e.specialAccountingCertificate ? `посвідчення № ${e.specialAccountingCertificate}` : '', e.reservationUntil ? `до ${formatUa(e.reservationUntil)} р.` : ''])
    : '';
  const deferral = e.deferralMobilizationBasis
    ? join([e.deferralMobilizationBasis, e.deferralUntil ? `до ${formatUa(e.deferralUntil)} р.` : ''])
    : '';
  return join([reservation, deferral], '; ');
}

/** Колонка 15: придатність (для офіцерів та призовників не заповнюється). */
export function fitnessText(e: E): string {
  if (isOfficer(e) || isConscript(e)) return '';
  return join([e.fitness, e.fitnessBasis], ' ');
}

/** Колонка 16: сімейний стан і члени сім’ї з роком народження (формула BM6). */
export function familyText(e: E): string {
  const status = maritalStatusLabel(e.maritalStatus, e.gender);
  const members = (e.familyMembers ?? []).map((m) => {
    const year = m.birthDate ? `${m.birthDate.slice(0, 4)} р.н.` : '_______ р.н.';
    return `${FAMILY_RELATION_LABELS[m.relation]} - ${fullName(m)}, ${year}`;
  });
  return join([status, ...members], '; ');
}

/** Колонка 17: посада, реквізити акта про призначення / звільнення. */
export function positionText(e: E): string {
  const appointed = join([
    capitalize(e.position),
    e.positionSince ? `з ${formatUa(e.positionSince)} р.` : e.hireDate ? `з ${formatUa(e.hireDate)} р.` : '',
    e.positionOrder || (e.hireOrderNumber ? `наказ № ${e.hireOrderNumber}${e.hireOrderDate ? ` від ${formatUa(e.hireOrderDate)} р.` : ''}` : ''),
  ]);
  const dismissed = e.dismissalDate
    ? join([
        `звільнен${e.gender === 'F' ? 'а' : 'ий'} ${formatUa(e.dismissalDate)} р.`,
        e.dismissalOrderNumber ? `наказ № ${e.dismissalOrderNumber}${e.dismissalOrderDate ? ` від ${formatUa(e.dismissalOrderDate)} р.` : ''}` : '',
      ])
    : '';
  return join([appointed, dismissed], '; ');
}

/** Колонка 7: склад (профіль підготовки — для офіцера). */
export function compositionColumnText(e: E): string {
  return compositionText(e);
}
