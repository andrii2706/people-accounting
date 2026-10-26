/**
 * Правила валідації картки працівника — ЄДИНЕ джерело для фронтенду і бекенду.
 * Копії: frontend/src/app/core/validation/employee-rules.ts та backend/src/military/employee-rules.ts — тримайте їх однаковими
 * (після переходу на монорепо — один пакет @military/shared).
 * Без залежностей від Angular/NestJS.
 */

/** Максимальна довжина рядкових полів = довжина колонки в БД. */
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
  position: 300,
  department: 200,
  positionOrder: 300,
  hireOrderNumber: 50,
  registryNumber: 50,
  vos: 6,
  trainingProfile: 200,
  accountingCategory: 1,
  militaryDocType: 150,
  militaryDocSeries: 3,
  militaryDocNumber: 50,
  militaryDocIssuedBy: 300,
  militaryDocGeneratedAt: 16,
  fitness: 300,
  fitnessBasis: 200,
  reservationBasis: 500,
  specialAccountingCertificate: 100,
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
  /** Літери будь-якої абетки, апостроф, дефіс, пробіл. */
  name: /^[\p{L}][\p{L}'’ʼ\-\s.]*$/u,
  rnokpp: /^\d{10}$/,
  phone: /^\+?[\d\s()-]{10,20}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  /** Паспорт-книжечка: дві кириличні літери + 6 цифр. */
  passportBookSeries: /^[А-ЩЬЮЯҐЄІЇа-щьюяґєії]{2}$/u,
  passportBookNumber: /^\d{6}$/,
  /** ID-картка: 9 цифр, орган видачі — 4-значний код. */
  idCardNumber: /^\d{9}$/,
  idCardIssuer: /^\d{4}$/,
  foreignSeries: /^[A-Za-z]{2}$/,
  foreignNumber: /^\d{6}$/,
  militaryDocSeries: /^\p{L}{1,3}$/u,
  militaryDocNumber: /^[\p{L}\d/-]{1,50}$/u,
  /** ВОС: офіцери — 6 символів, інші — 3 (примітка у файлі обліку, колонка DD). */
  vosOfficer: /^[\p{L}\d]{6}$/u,
  vosOther: /^[\p{L}\d]{3}$/u,
  accountingCategory: /^[12]$/,
  militaryDocGeneratedAt: /^([01]\d|2[0-3]):[0-5]\d \d{2}\.\d{2}\.\d{4}$/,
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
  militaryDocSeries: 'Серія — 1–3 літери',
  militaryDocNumber: 'Лише літери, цифри, «-» та «/»',
  vosOfficer: 'Для офіцерів ВОС — 6 символів',
  vosOther: 'ВОС — 3 символи',
  accountingCategory: 'Категорія обліку / розряд — 1 або 2',
  militaryDocGeneratedAt: 'Формат: 10:15 12.06.2025',
  registryNumber: 'Лише цифри, літери, «-» та «/»',
  futureDate: 'Дата не може бути в майбутньому',
  beforeBirth: 'Раніше за дату народження',
  invalidDate: 'Некоректна дата',
} as const;

/** Дати, які не можуть бути в майбутньому. */
export const NOT_FUTURE_DATES = [
  'birthDate',
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'educationDocumentDate',
  'militaryDocIssuedAt',
  'tckRegisteredAt',
  'fitnessDate',
  'mobilizationOrderDate',
  'mobilizedAt',
  'demobilizedAt',
] as const;

/** Дати документів, що не можуть бути раніше дати народження. */
export const AFTER_BIRTH_DATES = [
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'educationDocumentDate',
  'hireDate',
  'militaryDocIssuedAt',
  'tckRegisteredAt',
] as const;

/**
 * РНОКПП містить дату народження (перші 5 цифр — кількість днів від 31.12.1899)
 * і стать (9-та цифра: непарна — чоловік). Повертає розбіжності як підказки, не як помилки.
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
