/**
 * Military registration domain logic.
 * Pure functions without DB dependencies — ports of the formulas of the employee card
 * (sheets 01–21, columns FD–GT) and sheets G1…G4R, OCL of the file new_military_list v8.6.
 */
import { addDays, daysBetween, fifthOfNextMonth, fullYears, type IsoDate, yearOf } from '../common/utils/dates.js';
import {
  type ChangeType,
  type DutyCategory,
  type ListGroup,
} from './dictionaries.js';
import { COMPOSITION_LABELS, findRank, OFFICER_MIN_CODE, type RankDef } from './ranks.js';

/** Minimal set of fields needed for the calculations. */
export interface MilitaryRecord {
  /** Is on military registration (false — removed/excluded or not subject to registration). */
  militaryRegistered: boolean;
  gender: 'M' | 'F';
  birthDate: IsoDate | null;
  rankCode: number | null;
  navy: boolean;
  hireDate: IsoDate | null;
  dismissalDate: IsoDate | null;
  reserveTeamNumber: string | null;
  mobilizationOrderDate: IsoDate | null;
  reserved: boolean;
  reservationBasis: string | null;
  reservationUntil: IsoDate | null;
  /** OTHER — reserved by another legal entity: the mark is enough, the term is optional. */
  reservedBy?: 'COMPANY' | 'OTHER';
  specialAccountingCertificate: string | null;
  deferralUntil: IsoDate | null;
  mobilizedAt: IsoDate | null;
  demobilizedAt: IsoDate | null;
  registryNumber: string | null;
  tckId: string | null;
  militaryDocNumber: string | null;
  trainingProfile: string | null;
}

export function isOfficer(r: Pick<MilitaryRecord, 'rankCode'>): boolean {
  return r.rankCode !== null && r.rankCode >= OFFICER_MIN_CODE;
}

export function isConscript(r: Pick<MilitaryRecord, 'rankCode'>): boolean {
  return r.rankCode === 0;
}

export function isReservist(r: Pick<MilitaryRecord, 'reserveTeamNumber'>): boolean {
  return !!r.reserveTeamNumber?.trim();
}

/** Is in military service through mobilization on the date (columns EV/EY). */
export function isMobilizedAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.mobilizedAt || r.mobilizedAt > date) return false;
  return !r.demobilizedAt || r.demobilizedAt < r.mobilizedAt || r.demobilizedAt >= date;
}

/** Is employed by the company on the date. */
export function isEmployedAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.hireDate || r.hireDate > date) return false;
  return !r.dismissalDate || r.dismissalDate >= date;
}

/**
 * Whether the employee is included in the operational lists on the date.
 * Employees dismissed during the year stay in the lists until the end of that year (with dismissal details) —
 * the condition `Date!C2 < DATE(YEAR(Z2)+1,1,1)` in formulas FD2…FK2.
 */
export function isOnListsAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.militaryRegistered) return false;
  if (!r.hireDate || r.hireDate > date) return false;
  if (r.dismissalDate && yearOf(date) > yearOf(r.dismissalDate)) return false;
  if (isMobilizedAt(r, date)) return false;
  return r.rankCode !== null || r.gender === 'F';
}

/**
 * Whether the employee appears in the personal military registration lists (Annex 5, ed. 2025).
 * Unlike the operational report, employees released from work because they were called up
 * stay in the lists with the mark "Військовослужбовець з …" (column 18).
 */
export function isOnPersonalListsAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.militaryRegistered) return false;
  if (!r.hireDate || r.hireDate > date) return false;
  if (r.dismissalDate && yearOf(date) > yearOf(r.dismissalDate)) return false;
  return r.rankCode !== null || r.gender === 'F';
}

/** Has reached the age limit for staying in the reserve for their rank. */
export function hasReachedAgeLimit(r: MilitaryRecord, date: IsoDate): boolean {
  const rank = findRank(r.rankCode);
  const age = fullYears(r.birthDate, date);
  return !!rank && age !== null && age >= rank.ageLimit;
}

/** Military duty category (column GH). */
export function dutyCategory(r: MilitaryRecord): DutyCategory | null {
  if (r.rankCode === null && r.gender === 'M') return null;
  if (isReservist(r)) return 'RESERVIST';
  if (isConscript(r)) return 'CONSCRIPT';
  return 'LIABLE';
}

/** List group (sheets G1…G4R). */
export function listGroup(r: MilitaryRecord): ListGroup | null {
  const reservist = isReservist(r);
  if (r.gender === 'F') return reservist ? 'G3R' : 'G3';
  if (r.rankCode === null) return null;
  if (isConscript(r)) return reservist ? 'G4R' : 'G4';
  if (isOfficer(r)) return reservist ? 'G1R' : 'G1';
  return reservist ? 'G2R' : 'G2';
}

/** Row of the operational report (Annex 12): 1.1 / 1.2 / 1.3 / 2. */
export type OperationalRow = '1.1' | '1.2' | '1.3' | '2';

export function operationalRow(group: ListGroup): OperationalRow {
  switch (group) {
    case 'G1':
    case 'G1R':
      return '1.1';
    case 'G2':
    case 'G2R':
      return '1.2';
    case 'G3':
    case 'G3R':
      return '1.3';
    default:
      return '2';
  }
}

/**
 * Reserved on the date: chosen explicitly in the form and the reservation term has not expired.
 * Reserved by another legal entity — the mark is enough; if the term is filled in, it is checked too.
 */
export function isReservedAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.reserved) return false;
  if (r.reservedBy === 'OTHER' && !r.reservationUntil) return true;
  return !!r.reservationUntil && r.reservationUntil >= date;
}

/** Has a mobilization order (column GP). */
export function hasMobilizationOrder(r: MilitaryRecord, date: IsoDate): boolean {
  if (isReservedAt(r, date)) return false;
  return isReservist(r) || (!!r.mobilizationOrderDate && r.mobilizationOrderDate <= date);
}

/** Composition for column 7: training profile for officers. */
export function compositionText(r: Pick<MilitaryRecord, 'rankCode' | 'trainingProfile' | 'navy'>): string {
  const rank = findRank(r.rankCode);
  if (!rank || rank.composition === 'CONSCRIPT') return '';
  if (isOfficer(r)) return r.trainingProfile ?? '';
  if (rank.composition === 'PRIVATE') return 'рядовий';
  return r.navy ? 'старшинський' : 'сержантський';
}

export function compositionLabel(rank: RankDef | undefined): string {
  return rank ? COMPOSITION_LABELS[rank.composition] : '';
}

export type WarningLevel = 'danger' | 'warning' | 'info';

export interface RecordWarning {
  code: string;
  level: WarningLevel;
  message: string;
}

/** Automatic checks the Excel file did not have, but which follow naturally from its logic. */
export function recordWarnings(r: MilitaryRecord, date: IsoDate, reservationAlertDays = 30): RecordWarning[] {
  const warnings: RecordWarning[] = [];
  if (r.dismissalDate && r.dismissalDate < date) return warnings;
  if (!r.militaryRegistered) return warnings;

  const rank = findRank(r.rankCode);
  const age = fullYears(r.birthDate, date);

  if (r.gender === 'M' && r.rankCode === null) {
    warnings.push({ code: 'NO_RANK', level: 'warning', message: 'Не вказано військове звання / статус призовника' });
  }
  if (!r.registryNumber) {
    warnings.push({ code: 'NO_REGISTRY', level: 'info', message: 'Немає реєстраційного номера в ЄДР призовників' });
  }
  if (!r.tckId) {
    warnings.push({ code: 'NO_TCK', level: 'warning', message: 'Не вказано ТЦК та СП, де перебуває на обліку' });
  }
  if (!r.militaryDocNumber && r.rankCode !== null) {
    warnings.push({ code: 'NO_MIL_DOC', level: 'warning', message: 'Немає реквізитів військово-облікового документа' });
  }
  if (rank && age !== null && age >= rank.ageLimit) {
    warnings.push({
      code: 'AGE_LIMIT',
      level: 'danger',
      message: `Досяг граничного віку (${rank.ageLimit}) — підлягає зняттю з військового обліку`,
    });
  }
  if (r.reserved && r.reservationUntil) {
    const left = daysBetween(date, r.reservationUntil);
    if (left < 0) {
      warnings.push({ code: 'RESERVATION_EXPIRED', level: 'danger', message: 'Строк бронювання минув' });
    } else if (left <= reservationAlertDays) {
      warnings.push({ code: 'RESERVATION_EXPIRING', level: 'warning', message: `Бронювання закінчується через ${left} дн.` });
    }
  }
  if (r.deferralUntil) {
    const left = daysBetween(date, r.deferralUntil);
    if (left < 0) {
      warnings.push({ code: 'DEFERRAL_EXPIRED', level: 'danger', message: 'Строк відстрочки минув' });
    } else if (left <= reservationAlertDays) {
      warnings.push({ code: 'DEFERRAL_EXPIRING', level: 'warning', message: `Відстрочка закінчується через ${left} дн.` });
    }
  }
  return warnings;
}

/**
 * Deadline for notifying the TCK about a change (Procedure No. 1487, p. 34, as amended by Resolution No. 812):
 *  • hiring and dismissal — within `days` (7) days from the date of the order;
 *  • other registration data (name, passport, address, position) — monthly, by the 5th of the next month.
 */
export function notificationDeadline(
  type: ChangeType,
  effectiveDate: IsoDate,
  orders?: { hireOrderDate: IsoDate | null; dismissalOrderDate: IsoDate | null } | null,
  days = 7,
): IsoDate {
  if (type === 'HIRE' || type === 'DISMISSAL') {
    const order = type === 'HIRE' ? orders?.hireOrderDate : orders?.dismissalOrderDate;
    return addDays(order || effectiveDate, days);
  }
  return fifthOfNextMonth(effectiveDate);
}
