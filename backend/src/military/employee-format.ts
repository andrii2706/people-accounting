/**
 * Text representations of employee fields for documents and lists.
 * They reproduce the CONCATENATE formulas of the employee card (columns FM–GE) and sheet «список».
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

/** Column 5: register number / RNOKPP. */
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

/** Column 8: reserve category (grade for officers), military registration document. */
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

/** Column 10: both passports. */
export function passportsText(e: E): string {
  return join([passportText(e), foreignPassportText(e)], '; ');
}

/** Column 9: education. */
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

/** Column 13: TCK. */
export function tckText(e: E): string {
  return e.tck?.name ?? '';
}

/** Column 14: special registration / team number / service in the reserve (formula GA2). */
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

/** Column 15: fitness (not filled for officers and conscripts). */
export function fitnessText(e: E): string {
  if (isOfficer(e) || isConscript(e)) return '';
  return join([e.fitness, e.fitnessBasis], ' ');
}

/** Column 16: marital status and family members with birth year (formula BM6). */
export function familyText(e: E): string {
  const status = maritalStatusLabel(e.maritalStatus, e.gender);
  const members = (e.familyMembers ?? []).map((m) => {
    const year = m.birthDate ? `${m.birthDate.slice(0, 4)} р.н.` : '_______ р.н.';
    return `${FAMILY_RELATION_LABELS[m.relation]} - ${fullName(m)}, ${year}`;
  });
  return join([status, ...members], '; ');
}

/** Column 17: position, details of the appointment / dismissal order. */
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

/** Column 7: composition (training profile for an officer). */
export function compositionColumnText(e: E): string {
  return compositionText(e);
}
