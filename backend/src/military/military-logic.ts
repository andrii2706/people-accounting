/**
 * Pure functions without DB dependencies — ports of the formulas of the employee card
 * (sheets 01–21, columns FD–GT) and sheets G1…G4R, OCL of the file new_military_list v8.6.
 */
import { addDays, daysBetween, fifthOfNextMonth, fullYears, yearOf } from '../common/utils/dates.js';
import { COMPOSITION_LABELS, findRank, OFFICER_MIN_CODE } from './ranks.js';
import type { IsoDate } from '../shared/interfaces/common.interface.js';
import type { ChangeType, ListGroup, DutyCategory, RankDef } from '../shared/interfaces/dictionary.interface.js';
import type { MilitaryRecord, OperationalRow, RecordWarning } from '../shared/interfaces/employee.interface.js';

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

/**
 * List group (sheets G1…G4R). Conscripts go into group 4 regardless of gender —
 * women conscripts are counted with all conscripts, not in the women's list (group 3).
 */
export function listGroup(r: MilitaryRecord): ListGroup | null {
  const reservist = isReservist(r);
  if (isConscript(r)) return reservist ? 'G4R' : 'G4';
  if (r.gender === 'F') return reservist ? 'G3R' : 'G3';
  if (r.rankCode === null) return null;
  if (isOfficer(r)) return reservist ? 'G1R' : 'G1';
  return reservist ? 'G2R' : 'G2';
}

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

const uaDate = (iso: IsoDate) => iso.split('-').reverse().join('.');

/** «сьогодні», «через 1 день», «через 3 дні», «через 12 днів». */
function inDays(n: number): string {
  if (n === 0) return 'сьогодні';
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дні' : 'днів';
  return `через ${n} ${word}`;
}

/** Automatic checks the Excel file did not have, but which follow naturally from its logic. */
export function recordWarnings(r: MilitaryRecord, date: IsoDate, reservationAlertDays = 30): RecordWarning[] {
  const warnings: RecordWarning[] = [];
  if (r.dismissalDate && r.dismissalDate < date) return warnings;
  if (!r.militaryRegistered) return warnings;

  const rank = findRank(r.rankCode);
  const age = fullYears(r.birthDate, date);

  if (r.gender === 'M' && r.rankCode === null) {
    warnings.push({
      code: 'NO_RANK',
      level: 'warning',
      message:
        'Не вказано військове звання. Оберіть звання (або «призовник») у картці на вкладці «Військово-облікові дані».',
    });
  }
  if (!r.registryNumber) {
    warnings.push({
      code: 'NO_REGISTRY',
      level: 'info',
      message:
        'Не вказано номер у реєстрі «Оберіг» — його видно в застосунку Резерв+ або у військово-обліковому документі.',
    });
  }
  if (!r.tckId) {
    warnings.push({
      code: 'NO_TCK',
      level: 'warning',
      message: 'Не обрано ТЦК, де працівник стоїть на обліку, — без цього не вийде сформувати повідомлення в ТЦК.',
    });
  }
  // an electronic document (єВОД) has no number — it is enough by itself
  if (!r.militaryDocNumber && !r.hasElectronicDocument && r.rankCode !== null) {
    warnings.push({
      code: 'NO_MIL_DOC',
      level: 'warning',
      message: r.hasMilitaryDocument
        ? 'У військово-обліковому документі не вказано номер — допишіть його в картці, інакше повідомлення в ТЦК буде неповним.'
        : 'Не додано військово-обліковий документ (військовий квиток, посвідчення або е-документ з Резерв+). Додайте його в картці на вкладці «Військово-облікові дані».',
    });
  }
  if (rank && age !== null && age >= rank.ageLimit) {
    warnings.push({
      code: 'AGE_LIMIT',
      ref: r.birthDate ?? undefined,
      level: 'danger',
      message: `Виповнилося ${rank.ageLimit} років — граничний вік перебування в запасі. Працівника потрібно зняти з військового обліку.`,
    });
  }
  if (r.reserved && r.reservationUntil) {
    const left = daysBetween(date, r.reservationUntil);
    if (left < 0) {
      warnings.push({
        code: 'RESERVATION_EXPIRED',
        ref: r.reservationUntil,
        level: 'danger',
        message: `Бронювання закінчилося ${uaDate(r.reservationUntil)}. Продовжте бронювання або зніміть відмітку «Заброньований».`,
      });
    } else if (left <= reservationAlertDays) {
      warnings.push({
        code: 'RESERVATION_EXPIRING',
        ref: r.reservationUntil,
        level: 'warning',
        message: `Бронювання закінчується ${uaDate(r.reservationUntil)} (${inDays(left)}) — подбайте про продовження.`,
      });
    }
  }
  if (r.deferralUntil) {
    const left = daysBetween(date, r.deferralUntil);
    if (left < 0) {
      warnings.push({
        code: 'DEFERRAL_EXPIRED',
        ref: r.deferralUntil,
        level: 'danger',
        message: `Відстрочка закінчилася ${uaDate(r.deferralUntil)}. Уточніть у працівника (Резерв+) і оновіть дані в картці.`,
      });
    } else if (left <= reservationAlertDays) {
      warnings.push({
        code: 'DEFERRAL_EXPIRING',
        ref: r.deferralUntil,
        level: 'warning',
        message: `Відстрочка закінчується ${uaDate(r.deferralUntil)} (${inDays(left)}) — нагадайте працівнику оформити нову.`,
      });
    }
  }
  if (r.nextVlkDate && !r.reserved) {
    const left = daysBetween(date, r.nextVlkDate);
    if (left < 0) {
      warnings.push({
        code: 'VLK_OVERDUE',
        ref: r.nextVlkDate,
        level: 'danger',
        message: `Наступна ВЛК мала бути ${uaDate(r.nextVlkDate)}. Уточніть у працівника результат і оновіть дати ВЛК.`,
      });
    } else if (left <= reservationAlertDays) {
      warnings.push({
        code: 'VLK_SOON',
        ref: r.nextVlkDate,
        level: 'warning',
        message: `Наступна ВЛК ${uaDate(r.nextVlkDate)} (${inDays(left)}) — нагадайте працівнику.`,
      });
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
