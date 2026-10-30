import { fullYears, type IsoDate } from '../common/utils/dates.js';
import type { DutyCategory, ListGroup } from '../military/dictionaries.js';
import { fullName } from '../military/employee-format.js';
import {
  dutyCategory,
  isEmployedAt,
  isMobilizedAt,
  isOnListsAt,
  isReservedAt,
  listGroup,
  type MilitaryRecord,
  type RecordWarning,
  recordWarnings,
} from '../military/military-logic.js';
import { COMPOSITION_LABELS, findRank, rankTitle } from '../military/ranks.js';
import type { Employee } from './entities/employee.entity.js';

export function toMilitaryRecord(e: Employee): MilitaryRecord {
  const s = (v: string | null | undefined) => (v && v.trim() ? v : null);
  return {
    militaryRegistered: e.militaryRegistered,
    gender: e.gender,
    birthDate: e.birthDate,
    rankCode: e.rankCode,
    navy: e.navy,
    hireDate: e.hireDate,
    dismissalDate: e.dismissalDate,
    reserveTeamNumber: s(e.reserveTeamNumber),
    mobilizationOrderDate: e.mobilizationOrderDate,
    reserved: e.reserved,
    reservationBasis: s(e.reservationBasis),
    reservationUntil: e.reservationUntil,
    reservedBy: e.reservedBy,
    specialAccountingCertificate: s(e.specialAccountingCertificate),
    deferralUntil: e.deferralUntil,
    mobilizedAt: e.mobilizedAt,
    demobilizedAt: e.demobilizedAt,
    registryNumber: s(e.registryNumber),
    tckId: e.tckId,
    militaryDocNumber: s((e.militaryDocuments ?? []).find((d) => d.number?.trim())?.number),
    trainingProfile: s(e.trainingProfile),
  };
}

export interface EmployeeDerived {
  fullName: string;
  age: number | null;
  rankTitle: string;
  compositionLabel: string;
  dutyCategory: DutyCategory | null;
  listGroup: ListGroup | null;
  employed: boolean;
  onLists: boolean;
  mobilized: boolean;
  reserved: boolean;
  warnings: RecordWarning[];
}

export function deriveEmployee(e: Employee, date: IsoDate, alertDays = 30): EmployeeDerived {
  const r = toMilitaryRecord(e);
  const rank = findRank(e.rankCode);
  return {
    fullName: fullName(e),
    age: fullYears(e.birthDate, date),
    rankTitle: rankTitle(e.rankCode, e.navy),
    compositionLabel: rank ? COMPOSITION_LABELS[rank.composition] : '',
    dutyCategory: e.militaryRegistered ? dutyCategory(r) : null,
    listGroup: e.militaryRegistered ? listGroup(r) : null,
    employed: isEmployedAt(r, date),
    onLists: isOnListsAt(r, date),
    mobilized: isMobilizedAt(r, date),
    reserved: isReservedAt(r, date),
    warnings: recordWarnings(r, date, alertDays),
  };
}
