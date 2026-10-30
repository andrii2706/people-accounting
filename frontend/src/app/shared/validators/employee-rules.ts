/**
 * Employee card validation rules — the SINGLE source for the frontend and backend.
 * Copies: frontend/src/app/shared/validators/employee-rules.ts and backend/src/military/employee-rules.ts — keep them identical
 * (after moving to a monorepo — one package @military/shared).
 * No dependencies on Angular/NestJS.
 */

/** Maximum length of string fields = column length in the DB. */
export const MAX_LENGTH = {
  personnelNumber: 30,
  lastName: 100,
  firstName: 100,
  middleName: 100,
  rnokpp: 10,
  phone: 20,
  email: 200,
  registeredAddress: 500,
  actualAddress: 500,
  passportSeries: 2,
  passportNumber: 9,
  passportIssuedBy: 300,
  foreignPassportSeries: 2,
  foreignPassportNumber: 6,
  foreignPassportIssuedBy: 300,
  educationLevel: 100,
  educationSpecialty: 300,
  educationDocument: 300,
  educationInstitution: 300,
  position: 300,
  department: 200,
  positionOrder: 300,
  hireOrderDocName: 100,
  hireOrderNumber: 50,
  dismissalOrderDocName: 100,
  dismissalOrderNumber: 50,
  orderDocName: 100,
  orderNumber: 50,
  registryNumber: 50,
  vos: 6,
  trainingProfile: 200,
  accountingCategory: 1,
  docType: 150,
  docSeries: 3,
  docNumber: 50,
  docIssuedBy: 300,
  docGeneratedTime: 5,
  fitness: 300,
  fitnessBasis: 200,
  reservationBasis: 500,
  specialAccountingCertificate: 100,
  reservedByName: 300,
  reservedByEdrpou: 8,
  deferralConscriptionBasis: 500,
  deferralMobilizationBasis: 500,
  reserveTeamNumber: 100,
  militaryServiceInfo: 5000,
  mobilizationReleaseOrder: 50,
  readmissionOrder: 50,
  notes: 5000,
  changeBasis: 1000,
} as const;

export type MaxLengthField = keyof typeof MAX_LENGTH;

export const PATTERN = {
  /** Letters of any alphabet, apostrophe, hyphen, space. */
  name: /^[\p{L}][\p{L}'’ʼ\-\s.]*$/u,
  rnokpp: /^\d{10}$/,
  phone: /^\+?[\d\s()-]{10,20}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  /** Booklet passport: two Cyrillic letters + 6 digits. */
  passportBookSeries: /^[А-ЩЬЮЯҐЄІЇа-щьюяґєії]{2}$/u,
  passportBookNumber: /^\d{6}$/,
  /** ID card: 9 digits, issuing authority — a 4-digit code. */
  idCardNumber: /^\d{9}$/,
  idCardIssuer: /^\d{4}$/,
  foreignSeries: /^[A-Za-z]{2}$/,
  foreignNumber: /^\d{6}$/,
  docSeries: /^\p{L}{1,3}$/u,
  docNumber: /^[\p{L}\d/-]{1,50}$/u,
  /** Military occupational specialty: officers — 6 characters, others — 3 (note in the Excel file, column DD). */
  vosOfficer: /^[\p{L}\d]{6}$/u,
  vosOther: /^[\p{L}\d]{3}$/u,
  accountingCategory: /^[12]$/,
  /** Time the e-document was generated: HH:MM. */
  docGeneratedTime: /^([01]\d|2[0-3]):[0-5]\d$/,
  edrpou: /^\d{8}$/,
  registryNumber: /^[\p{L}\d\-/ ]{1,50}$/u,
} as const;

export const MESSAGE = {
  required: 'Обов’язкове поле',
  tooLong: (max: number) => `Не більше ${max} символів`,
  name: 'Лише літери, апостроф і дефіс',
  rnokpp: 'РНОКПП — рівно 10 цифр',
  phone: 'Формат: +380 67 123 45 67',
  email: 'Некоректний email',
  passportBookSeries: 'Серія — дві літери кирилицею, напр. КС',
  passportBookNumber: 'Номер паспорта-книжечки — 6 цифр',
  idCardNumber: 'Номер ID-картки — 9 цифр',
  idCardIssuer: 'Для ID-картки — 4-значний код органу, напр. 4610',
  foreignSeries: 'Серія — дві латинські літери, напр. FA',
  foreignNumber: 'Номер — 6 цифр',
  docSeries: 'Серія — 1–3 літери',
  docNumber: 'Лише літери, цифри, «-» та «/»',
  vosOfficer: 'Для офіцерів ВОС — 6 символів',
  vosOther: 'ВОС — 3 символи',
  accountingCategory: 'Категорія обліку / розряд — 1 або 2',
  docGeneratedTime: 'Час у форматі ГГ:ХХ, напр. 10:15',
  edrpou: 'Код ЄДРПОУ — 8 цифр',
  registryNumber: 'Лише цифри, літери, «-» та «/»',
  futureDate: 'Дата не може бути в майбутньому',
  beforeBirth: 'Раніше за дату народження',
  invalidDate: 'Некоректна дата',
} as const;

/** Dates that cannot be in the future. */
export const NOT_FUTURE_DATES = [
  'birthDate',
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'educationDocumentDate',
  'tckRegisteredAt',
  'fitnessDate',
  'mobilizationOrderDate',
  'mobilizedAt',
  'demobilizedAt',
] as const;

/** Document dates that cannot be earlier than the date of birth. */
export const AFTER_BIRTH_DATES = [
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'educationDocumentDate',
  'hireDate',
  'tckRegisteredAt',
] as const;

/**
 * RNOKPP contains the date of birth (first 5 digits — days since 31.12.1899)
 * and the sex (9th digit: odd — male). Returns mismatches as hints, not as errors.
 */
export function rnokppMismatch(
  rnokpp: string,
  birthDate: string,
  gender: 'M' | 'F',
): string | null {
  if (!PATTERN.rnokpp.test(rnokpp)) return null;
  const days = Number(rnokpp.slice(0, 5));
  const encoded = new Date(Date.UTC(1899, 11, 31) + days * 86_400_000).toISOString().slice(0, 10);
  const genderDigit = Number(rnokpp[8]);
  const encodedGender = genderDigit % 2 === 1 ? 'M' : 'F';
  const problems: string[] = [];
  if (birthDate && encoded !== birthDate) {
    const [y, m, d] = encoded.split('-');
    problems.push(`за РНОКПП дата народження ${d}.${m}.${y}`);
  }
  if (encodedGender !== gender)
    problems.push(`за РНОКПП стать ${encodedGender === 'M' ? 'чоловіча' : 'жіноча'}`);
  return problems.length ? `Перевірте: ${problems.join(', ')}` : null;
}
