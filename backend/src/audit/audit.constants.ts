/** Fields whose values are never written to the audit log in plain text. */
export const AUDIT_SENSITIVE_FIELDS = new Set([
  'rnokpp',
  'passportSeries',
  'passportNumber',
  'foreignPassportSeries',
  'foreignPassportNumber',
  'militaryDocNumber',
  'militaryDocuments',
  'registryNumber',
  'passwordHash',
  'password',
]);
