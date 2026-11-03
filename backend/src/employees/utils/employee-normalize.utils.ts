import { fieldErrors } from '../../common/validators/validators.js';
import { EDUCATION_LEVELS } from '../../military/dictionaries.js';
import { isConscript } from '../../military/military-logic.js';
import type { Employee } from '../entities/employee.entity.js';
import { dateUa, joinParts } from './employee-text.utils.js';

/**
 * Reservation is used only when "Заброньований" is chosen explicitly: then its term is required
 * (same rule as on the frontend), otherwise the reservation data is cleared.
 */
export function applyReservation(e: Employee) {
  // «пункт, розділ, номер переліку» is no longer kept (feedback 28.10.2026)
  e.reservationBasis = '';
  if (e.reserved && isConscript(e)) e.reserved = false;
  if (!e.reserved) {
    e.reserved = false;
    e.reservationBasis = '';
    e.reservationUntil = null;
    e.specialAccountingCertificate = '';
    e.reservedBy = 'COMPANY';
    e.reservedByName = '';
    e.reservedByEdrpou = '';
    return;
  }
  // reserved by another legal entity: the mark is enough, name / EDRPOU / term / certificate are optional
  if (e.reservedBy === 'OTHER') return;
  e.reservedBy = 'COMPANY';
  e.reservedByName = '';
  e.reservedByEdrpou = '';
  if (!e.reservationUntil) throw fieldErrors([{ field: 'reservationUntil', message: 'Вкажіть строк бронювання' }]);
}

/** A deferral «до завершення мобілізації» has no fixed date. */
export function applyDeferral(e: Employee) {
  // a reserved employee has no deferral (feedback 30.10.2026)
  if (e.reserved) {
    e.deferralConscriptionBasis = '';
    e.deferralMobilizationBasis = '';
    e.deferralUntil = null;
    e.deferralUntilMobilizationEnd = false;
    e.nextVlkDate = null;
    return;
  }
  // one kind only: from conscript service OR from conscription during mobilization
  if (e.deferralConscriptionBasis?.trim() && e.deferralMobilizationBasis?.trim()) {
    throw fieldErrors([
      {
        field: 'deferralMobilizationBasis',
        message: 'Оберіть один вид відстрочки: від строкової служби або від мобілізації',
      },
    ]);
  }
  // «до завершення мобілізації» is only for the deferral from mobilization
  if (!e.deferralMobilizationBasis?.trim()) e.deferralUntilMobilizationEnd = false;
  if (e.deferralUntilMobilizationEnd) e.deferralUntil = null;
  // the next ВЛК is tracked only for a deferral
  const hasDeferral = !!(e.deferralConscriptionBasis?.trim() || e.deferralMobilizationBasis?.trim());
  if (!hasDeferral && !e.deferralUntil && !e.deferralUntilMobilizationEnd) e.nextVlkDate = null;
}

/** The latest position (by date) is the current one; its data is mirrored into the employee card. */
export function applyPositions(e: Employee) {
  const positions = [...(e.positions ?? [])].sort((a, b) => (a.since ?? '').localeCompare(b.since ?? ''));
  const current = positions.at(-1);
  if (!current) return;
  e.position = current.position;
  e.department = current.department ?? '';
  e.positionSince = current.since ?? null;
  e.positionOrder = joinParts(
    [
      current.orderDocName || current.orderNumber || current.orderDate ? current.orderDocName || 'наказ' : '',
      current.orderNumber ? `№ ${current.orderNumber}` : '',
      current.orderDate ? `від ${dateUa(current.orderDate)}` : '',
    ],
    ' ',
  );
}

/** The highest level (by the dictionary order) is mirrored into the card fields — lists, import, documents. */
export function applyEducations(e: Employee) {
  const list = e.educations ?? [];
  const rank = (level: string) => {
    const i = (EDUCATION_LEVELS as readonly string[]).indexOf(level);
    return i < 0 ? EDUCATION_LEVELS.length : i;
  };
  const best = [...list].sort(
    (a, b) => rank(a.level) - rank(b.level) || (b.documentDate ?? '').localeCompare(a.documentDate ?? ''),
  )[0];
  e.educationLevel = best?.level ?? '';
  e.educationSpecialty = best?.specialty ?? '';
  e.educationDocument = best ? joinParts([best.institution, best.document], ', ') : '';
  e.educationDocumentDate = best?.documentDate ?? null;
}
