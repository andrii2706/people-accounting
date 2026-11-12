import type { Employee } from '../../employees/entities/employee.entity.js';
import { toMilitaryRecord } from '../../employees/utils/employee-view.utils.js';
import { dutyCategory, isEmployedAt, isReservedAt } from '../../military/military-logic.js';
import type { IsoDate } from '../../shared/interfaces/common.interface.js';
import type { EntityQuota, QuotaStanding } from '../../shared/interfaces/legal-entity.interface.js';
import type { LegalEntity } from '../legal-entity.entity.js';

/**
 * Places under the quota: the percent of the base, rounded down (the quota never exceeds the percent).
 * Integer arithmetic on hundredths of a percent — no floating-point surprises (50% of 7 = 3).
 */
export function quotaPlaces(percent: number | null, base: number): number | null {
  if (percent === null) return null;
  return Math.floor((base * Math.round(percent * 100)) / 10_000);
}

/** How one employee counts for the quota of his legal entity on the date. */
export function quotaStanding(e: Employee, date: IsoDate): QuotaStanding {
  const r = toMilitaryRecord(e);
  const employed = isEmployedAt(r, date);
  const reserved = employed && isReservedAt(r, date);
  return {
    legalEntityId: e.legalEntityId,
    employed,
    // the base: working military-liable men (no conscripts, no reservists, no women);
    // those reserved by another enterprise do not count — they are not this entity's to reserve
    inBase:
      employed &&
      e.gender === 'M' &&
      e.militaryRegistered &&
      dutyCategory(r) === 'LIABLE' &&
      !(reserved && e.reservedBy === 'OTHER'),
    reservedOwn: reserved && e.reservedBy !== 'OTHER',
  };
}

/** Quota of one legal entity: places = percent × military-liable men, free = places − reserved by it. */
export function entityQuota(
  entity: Pick<LegalEntity, 'id' | 'fullName' | 'shortName' | 'reservationQuotaPercent' | 'reservationQuotaValidUntil'>,
  staff: QuotaStanding[],
  today: IsoDate,
): EntityQuota {
  const own = staff.filter((s) => s.legalEntityId === entity.id);
  const base = own.filter((s) => s.inBase).length;
  const reservedCompany = own.filter((s) => s.reservedOwn).length;
  const percent = entity.reservationQuotaPercent;
  const quota = quotaPlaces(percent, base);
  const validUntil = entity.reservationQuotaValidUntil ?? null;
  const expired = validUntil !== null && validUntil < today;
  return {
    id: entity.id,
    name: entity.shortName || entity.fullName,
    percent,
    base,
    quota,
    reservedCompany,
    // the criticality is over (the last day is inclusive) — the places stay for reference, none is free
    available: quota === null ? null : expired ? 0 : Math.max(quota - reservedCompany, 0),
    exceeded: quota !== null && reservedCompany > quota,
    validUntil,
    expired,
  };
}
