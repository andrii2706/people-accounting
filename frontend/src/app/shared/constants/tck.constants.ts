import type { TckFilter } from '../interfaces/dictionary.interface';
import type { TckForm } from '../interfaces/organization.interface';

export const EMPTY_TCK_FORM: TckForm = {
  name: '',
  nameGenitive: '',
  address: '',
  postalCode: '',
  phone: '',
  email: '',
  region: '',
  district: '',
  city: '',
};

/** The district filter value of the regional and city centres (they serve no single district). */
export const NO_TCK_DISTRICT = '—';
export const NO_TCK_DISTRICT_LABEL = 'Обласні та міські ТЦК';

export const EMPTY_TCK_FILTER: TckFilter = { query: '', region: '', city: '', district: '' };

/** A TCK export file (npm run tck:export) is small; anything bigger is not it. */
export const MAX_TCK_IMPORT_BYTES = 2_000_000;
export const MAX_TCK_IMPORT_ITEMS = 2000;
/** Length of the place fields (region, district, town) — as on the server. */
export const TCK_PLACE_MAX = 100;
