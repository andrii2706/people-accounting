import type { TckForm } from '../interfaces/organization.interface';

export const EMPTY_TCK_FORM: TckForm = {
  name: '',
  nameGenitive: '',
  address: '',
  postalCode: '',
  phone: '',
  email: '',
};

/** A TCK export file (npm run tck:export) is small; anything bigger is not it. */
export const MAX_TCK_IMPORT_BYTES = 2_000_000;
export const MAX_TCK_IMPORT_ITEMS = 2000;
