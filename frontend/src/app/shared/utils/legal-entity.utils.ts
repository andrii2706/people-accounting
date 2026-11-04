import { YOUCONTROL_COMPANY_URL } from '../constants/legal-entity.constants';
import { EMPTY_LEGAL_ENTITY } from '../constants/legal-entity.constants';
import type {
  LegalEntity,
  LegalEntityBody,
  LegalEntityForm,
  LegalEntitySummary,
  RegistryCompany,
} from '../interfaces/legal-entity.interface';
import type { SelectOption } from '../interfaces/ui.interface';
import { PATTERN } from '../validators/employee-rules';

/** Link to the company in YouControl; '' while the code is not valid. */
export function youControlUrl(code: string): string {
  const c = code.trim();
  return PATTERN.companyCode.test(c) ? YOUCONTROL_COMPANY_URL.replace('{code}', c) : '';
}

/** Saved entity → form model (null → a blank form). */
export function legalEntityToForm(entity: LegalEntity | null): LegalEntityForm {
  if (!entity) return { ...EMPTY_LEGAL_ENTITY };
  const form = { ...EMPTY_LEGAL_ENTITY };
  for (const key of Object.keys(form) as (keyof LegalEntityForm)[]) {
    const value = entity[key];
    form[key] = value === null || value === undefined ? '' : String(value);
  }
  return form;
}

/** Form model → request body: trimmed strings, an empty quota — null. */
export function legalEntityBody(model: LegalEntityForm): LegalEntityBody {
  const trimmed = { ...model };
  for (const key of Object.keys(trimmed) as (keyof LegalEntityForm)[])
    trimmed[key] = trimmed[key].trim();
  return {
    ...trimmed,
    reservationQuota: trimmed.reservationQuota ? Number(trimmed.reservationQuota) : null,
  };
}

/**
 * Registry data on top of the form: fills only what the registry knows, does not touch the
 * responsible person, the phone, e-mail or the letter prefix. Empty values from the registry keep the form.
 */
export function applyRegistry(model: LegalEntityForm, company: RegistryCompany): LegalEntityForm {
  return {
    ...model,
    edrpou: company.edrpou || model.edrpou,
    fullName: company.fullName || model.fullName,
    shortName: company.shortName || model.shortName,
    address: company.address || model.address,
    postalCode: company.postalCode || model.postalCode,
    headName: company.headName || model.headName,
  };
}

/** Name for lists and selects: the short name if set. */
export const legalEntityName = (e: Pick<LegalEntitySummary, 'shortName' | 'fullName'>) =>
  e.shortName || e.fullName;

export const legalEntityOptions = (entities: LegalEntitySummary[]): SelectOption[] =>
  entities.map((e) => ({ value: e.id, label: legalEntityName(e), hint: `ЄДРПОУ ${e.edrpou}` }));
