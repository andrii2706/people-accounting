import { formatUa } from '../../common/utils/dates.utils.js';
import type { Employee } from '../entities/employee.entity.js';

/** «2026-10-28» → «28.10.2026 р.»; empty for no date. */
export const dateUa = (d: string | null | undefined) => (d ? `${formatUa(d)} р.` : '');

/** Joins the non-empty parts. */
export const joinParts = (parts: (string | false | null | undefined)[], sep = ', ') => parts.filter(Boolean).join(sep);

export function deferralText(e: Employee): string {
  const until = e.deferralUntilMobilizationEnd
    ? 'до завершення мобілізації'
    : e.deferralUntil
      ? `до ${dateUa(e.deferralUntil)}`
      : '';
  return joinParts([e.deferralConscriptionBasis, e.deferralMobilizationBasis, until]);
}

/** Reserved by another legal entity: the mark plus whatever details are filled in (all optional). */
export function otherReservationText(
  e: Pick<Employee, 'reservedByName' | 'reservedByEdrpou' | 'reservationUntil' | 'specialAccountingCertificate'>,
): string {
  return joinParts([
    'заброньований іншою юридичною особою',
    e.reservedByName?.trim()
      ? `${e.reservedByName.trim()}${e.reservedByEdrpou ? ` (ЄДРПОУ ${e.reservedByEdrpou})` : ''}`
      : e.reservedByEdrpou
        ? `ЄДРПОУ ${e.reservedByEdrpou}`
        : '',
    e.reservationUntil ? `до ${dateUa(e.reservationUntil)}` : '',
    e.specialAccountingCertificate ? `посвідчення № ${e.specialAccountingCertificate}` : '',
  ]);
}

export function reservationText(e: Employee): string {
  if (!e.reserved) return '';
  if (e.reservedBy === 'OTHER') return otherReservationText(e);
  return joinParts([
    e.reservationUntil ? `до ${dateUa(e.reservationUntil)}` : '',
    e.specialAccountingCertificate ? `посвідчення № ${e.specialAccountingCertificate}` : '',
  ]);
}

export const educationsText = (e: Employee) =>
  [...(e.educations ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) =>
      joinParts([
        d.level,
        d.institution,
        d.specialty,
        d.document,
        d.documentDate ? `від ${dateUa(d.documentDate)}` : '',
      ]),
    )
    .join('; ');

export const positionsText = (e: Employee) =>
  [...(e.positions ?? [])]
    .sort((a, b) => (a.since ?? '').localeCompare(b.since ?? ''))
    .map((p) =>
      joinParts([
        p.position,
        p.department,
        p.since ? `з ${dateUa(p.since)}` : '',
        p.orderNumber ? `№ ${p.orderNumber}` : '',
      ]),
    )
    .join('; ');

/** «шевченко-ковальська» → «Шевченко-Ковальська» (like UPPER(MID(...,1,1)) in the formulas). */
export function capitalizeName(value: string) {
  return value
    .split(/([-\s’'])/)
    .map((part) =>
      part.length > 1 || /[a-zа-яіїєґ]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join('');
}

/** «Прізвище Ім’я По батькові». */
export const employeeFullName = (e: Employee) => `${e.lastName} ${e.firstName} ${e.middleName}`.trim();
