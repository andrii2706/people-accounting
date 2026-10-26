/**
 * Доменна логіка військового обліку.
 * Чисті функції без залежностей від БД — перенесення формул з картки працівника
 * (аркуші 01–21, колонки FD–GT) та аркушів G1…G4R, OCL файлу new_military_list v8.6.
 */
import { addDays, daysBetween, fullYears, type IsoDate, yearOf } from '../common/utils/dates.js';
import {
  type DutyCategory,
  type ListGroup,
} from './dictionaries.js';
import { COMPOSITION_LABELS, findRank, OFFICER_MIN_CODE, type RankDef } from './ranks.js';

/** Мінімальний набір полів, потрібний для розрахунків. */
export interface MilitaryRecord {
  /** Перебуває на військовому обліку (false — знятий/виключений або не підлягає обліку). */
  militaryRegistered: boolean;
  gender: 'M' | 'F';
  birthDate: IsoDate | null;
  rankCode: number | null;
  navy: boolean;
  hireDate: IsoDate | null;
  dismissalDate: IsoDate | null;
  reserveTeamNumber: string | null;
  mobilizationOrderDate: IsoDate | null;
  reservationBasis: string | null;
  reservationUntil: IsoDate | null;
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

/** Перебуває на військовій службі за мобілізацією на дату (колонки EV/EY). */
export function isMobilizedAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.mobilizedAt || r.mobilizedAt > date) return false;
  return !r.demobilizedAt || r.demobilizedAt < r.mobilizedAt || r.demobilizedAt >= date;
}

/** Працює на підприємстві на дату. */
export function isEmployedAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.hireDate || r.hireDate > date) return false;
  return !r.dismissalDate || r.dismissalDate >= date;
}

/**
 * Чи потрапляє працівник у списки на дату.
 * Звільнені протягом року залишаються у списках до кінця року звільнення (з реквізитами звільнення) —
 * умова `Date!C2 < DATE(YEAR(Z2)+1,1,1)` у формулах FD2…FK2.
 */
export function isOnListsAt(r: MilitaryRecord, date: IsoDate): boolean {
  if (!r.militaryRegistered) return false;
  if (!r.hireDate || r.hireDate > date) return false;
  if (r.dismissalDate && yearOf(date) > yearOf(r.dismissalDate)) return false;
  if (isMobilizedAt(r, date)) return false;
  return r.rankCode !== null || r.gender === 'F';
}

/** Категорія військового обов’язку (колонка GH). */
export function dutyCategory(r: MilitaryRecord): DutyCategory | null {
  if (r.rankCode === null && r.gender === 'M') return null;
  if (isReservist(r)) return 'RESERVIST';
  if (isConscript(r)) return 'CONSCRIPT';
  return 'LIABLE';
}

/** Група списку (аркуші G1…G4R). */
export function listGroup(r: MilitaryRecord): ListGroup | null {
  const reservist = isReservist(r);
  if (r.gender === 'F') return reservist ? 'G3R' : 'G3';
  if (r.rankCode === null) return null;
  if (isConscript(r)) return reservist ? 'G4R' : 'G4';
  if (isOfficer(r)) return reservist ? 'G1R' : 'G1';
  return reservist ? 'G2R' : 'G2';
}

/** Рядок відомості оперативного обліку (Додаток 12): 1.1 / 1.2 / 1.3 / 2. */
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

/** Заброньований на дату (колонка GQ: бронювання до дати ≥ дата і є спецоблік). */
export function isReservedAt(r: MilitaryRecord, date: IsoDate): boolean {
  const hasSpecial = !!(r.reservationBasis?.trim() || r.specialAccountingCertificate?.trim());
  return hasSpecial && !!r.reservationUntil && r.reservationUntil >= date;
}

/** Має мобілізаційне розпорядження (колонка GP). */
export function hasMobilizationOrder(r: MilitaryRecord, date: IsoDate): boolean {
  if (isReservedAt(r, date)) return false;
  return isReservist(r) || (!!r.mobilizationOrderDate && r.mobilizationOrderDate <= date);
}

/** Склад для колонки 7 списку: для офіцерів — профіль підготовки. */
export function compositionText(r: MilitaryRecord): string {
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

/** Автоматичні перевірки, яких у Excel не було, але які напрошуються з його логіки. */
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
  if (r.reservationUntil) {
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

/** Кінцева дата, до якої ТЦК треба повідомити про зміну (7 днів). */
export function notificationDeadline(effectiveDate: IsoDate, days = 7): IsoDate {
  return addDays(effectiveDate, days);
}
