import type { EmployeeFormModel, FormTab } from '../interfaces/employee-form.interface';

/** Fields that make a section «filled» (for the progress in the section menu). Notes are optional. */
export function sectionKeyFields(m: EmployeeFormModel): Record<FormTab, boolean[]> {
  const conscript = m.rankCode === '0';
  const military = m.militaryRegistered
    ? [
        m.rankCode !== '',
        conscript || !!m.vos.trim(),
        !!m.tckId,
        !!m.registryNumber.trim(),
        m.militaryDocuments.some((d) => !!d.type),
      ]
    : [];
  return {
    personal: [
      !!m.lastName.trim(),
      !!m.firstName.trim(),
      !!m.birthDate,
      !!m.rnokpp.trim(),
      !!m.registeredAddress.trim(),
      !!m.phone.trim(),
    ],
    passport: [!!m.passportNumber.trim(), !!m.passportIssuedAt],
    education: [m.educations.some((e) => !!e.level)],
    family: [!!m.maritalStatus],
    work: [!!m.hireDate, m.positions.some((p) => !!p.position.trim())],
    military,
    notes: [],
  };
}

/** Share of the key fields filled, 0–100. */
export function completion(m: EmployeeFormModel): number {
  const all = Object.values(sectionKeyFields(m)).flat();
  return all.length ? Math.round((all.filter(Boolean).length / all.length) * 100) : 100;
}

const IGNORED = new Set(['changeEffectiveDate', 'changeBasis']);

/** How many fields differ from the saved card (for «N незбережених змін»). */
export function changedCount(before: EmployeeFormModel | null, after: EmployeeFormModel): number {
  if (!before) return 0;
  const a = before as unknown as Record<string, unknown>;
  const b = after as unknown as Record<string, unknown>;
  return Object.keys(b).filter(
    (k) => !IGNORED.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  ).length;
}
