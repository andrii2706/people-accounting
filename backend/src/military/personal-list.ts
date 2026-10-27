/**
 * Columns of the personal military registration lists — Annex 5 to Procedure No. 1487
 * as amended by CMU Resolution No. 916 of 30.07.2025, with the changes of Resolution No. 812
 * of 10.06.2026 (in force since 27.06.2026): 18 columns.
 * Layout follows sheets GN1…GN4R of the Excel file: a separate list per group, one row per record.
 * Column meanings follow the official "ПЕРЕЛІК інформації" that accompanies the form.
 */
import { formatUa, formatUaQuoted, type IsoDate } from '../common/utils/dates.js';
import type { Employee } from '../employees/entities/employee.entity.js';
import { toMilitaryRecord } from '../employees/employee-view.js';
import { fullName, militaryDocText, passportText, positionText, rankText } from './employee-format.js';
import { dutyCategory, hasReachedAgeLimit, isConscript, isMobilizedAt, isReservist } from './military-logic.js';

const join = (parts: Array<string | null | undefined | false>, sep = ', ') =>
  parts.filter((p): p is string => !!p && !!p.trim()).join(sep);
const until = (date: string | null) => (date ? `до ${formatUa(date)} р.` : '');

/** Column titles exactly as in the form (sheets GN*, row 7). */
export const LIST_TITLES = [
  'Порядковий номер',
  'Категорія військового обов’язку',
  'Військове звання',
  'Прізвище, власне ім’я та по батькові (за наявності)',
  'Число, місяць, рік народження',
  'Реєстраційний номер облікового запису в Єдиному державному реєстрі призовників, військовозобов’язаних та резервістів',
  'Реєстраційний номер облікової картки платника податків (за наявності)',
  'Військово-облікова спеціальність',
  'Реквізити військово-облікового документа (серія (за наявності), номер, ким та коли видано, час та дата формування)',
  'Реквізити паспорта громадянина України (серія (за наявності), номер, ким та коли видано)',
  'Адреса задекларованого/ зареєстрованого або фактичного місця проживання',
  'Найменування територіального центру комплектування та соціальної підтримки, органу СБУ, відповідного підрозділу розвідувального органу, в якому перебуває на військовому обліку',
  'Відомості про наявність відстрочки від призову на військову службу (направлення для проходження базової військової служби)',
  'Відомості про перебування на спеціальному військовому обліку',
  'Відомості про проходження військової служби',
  'Відомості про наявність мобілізаційного розпорядження (дата видачі)',
  'Посада, реквізити акта про призначення на посаду/ звільнення з посади',
  'Реквізити повідомлення про призначення на посаду/ звільнення з посади',
] as const;

/** Relative column widths — Excel column widths of sheets GN* (A…R). */
export const LIST_WIDTHS = [5.3, 12.2, 9.9, 11.1, 9.1, 24, 12.7, 8.2, 24, 18, 15.4, 17.1, 14.7, 12.7, 12.9, 15.3, 15.4, 13];

/** Column 2: category in the singular, as the form expects. */
export function categoryText(e: Employee): string {
  switch (dutyCategory(toMilitaryRecord(e))) {
    case 'CONSCRIPT':
      return 'призовник';
    case 'RESERVIST':
      return 'резервіст';
    case 'LIABLE':
      return e.gender === 'F' ? 'військовозобов’язана' : 'військовозобов’язаний';
    default:
      return '';
  }
}

/** Column 7: taxpayer number, or passport series/number for people who refused it on religious grounds. */
function taxNumberText(e: Employee): string {
  if (e.rnokpp) return e.rnokpp;
  return e.passportNumber ? join([e.passportSeries?.toUpperCase(), e.passportNumber], ' ') : '';
}

/** Column 11: registered address, plus the actual one when it differs (formula GN*!K9). */
function addressText(e: Employee): string {
  const registered = e.registeredAddress?.trim();
  const actual = e.actualAddress?.trim();
  if (registered && actual && actual !== registered) return `${registered}/ Фактичне місце проживання - ${actual}`;
  return registered || actual || '';
}

/** Column 13: deferral term and legal grounds. */
function deferralText(e: Employee): string {
  if (isConscript(e)) return e.deferralConscriptionBasis ?? '';
  if (!e.deferralMobilizationBasis && !e.deferralUntil) return '';
  return join([until(e.deferralUntil), e.deferralMobilizationBasis]);
}

/**
 * Column 14: reservation — only when "Заброньований" is chosen in the form
 * (like GL in the Excel file), and only for liable persons, not for reservists or conscripts.
 */
function reservationText(e: Employee): string {
  if (!e.reserved || isConscript(e) || isReservist(e)) return '';
  if (!e.reservationBasis && !e.reservationUntil) return '';
  return join([
    until(e.reservationUntil),
    e.reservationBasis,
    e.specialAccountingCertificate ? `посвідчення № ${e.specialAccountingCertificate}` : '',
  ]);
}

/** Column 16: mobilization order — "так/ні", issue date and team (military unit for reservists). */
function mobilizationOrderText(e: Employee): string {
  if (isConscript(e)) return '';
  if (isReservist(e)) {
    return join(['так', e.mobilizationOrderDate ? `від ${formatUa(e.mobilizationOrderDate)} р.` : '', `в/ч ${e.reserveTeamNumber}`]);
  }
  return e.mobilizationOrderDate ? `так, від ${formatUa(e.mobilizationOrderDate)} р.` : 'ні';
}

/** Column 18 mark for dismissed employees (Resolution No. 812 wording). */
export const MARK_DISMISSED = 'Звільнено з роботи, завершено навчання (відраховано)';

/** Column 18: notices sent to the TCK plus the marks required by the form (Resolution No. 812). */
function noticesText(e: Employee, date: IsoDate, notices: string): string {
  const r = toMilitaryRecord(e);
  return join(
    [
      notices,
      e.dismissalDate && e.dismissalDate <= date ? MARK_DISMISSED : '',
      isMobilizedAt(r, date) && e.mobilizedAt ? `Військовослужбовець з ${formatUaQuoted(e.mobilizedAt)}` : '',
      hasReachedAgeLimit(r, date) ? 'Виключено з військового обліку за віком' : '',
    ],
    '; ',
  );
}

/** All 18 cells of one record (column 1 — the record number — is filled by the caller). */
export function personalListCells(e: Employee, date: IsoDate, notices: string): string[] {
  const conscript = isConscript(e);
  return [
    '',
    categoryText(e),
    conscript ? '' : rankText(e),
    fullName(e),
    formatUa(e.birthDate, ''),
    e.registryNumber ?? '',
    taxNumberText(e),
    conscript ? '' : e.vos ?? '',
    militaryDocText(e),
    passportText(e),
    addressText(e),
    e.tck?.name ?? '',
    deferralText(e),
    reservationText(e),
    conscript ? '' : isMobilizedAt(toMilitaryRecord(e), date) ? 'так' : 'ні',
    mobilizationOrderText(e),
    positionText(e),
    noticesText(e, date, notices),
  ];
}
