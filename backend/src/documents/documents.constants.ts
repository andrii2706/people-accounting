/** Reconciliation: the extract goes to the TCK in two copies (one comes back with the marks), an eВОД — in one. */
export const EXTRACT_COPIES = 2;
export const EVOD_COPIES = 1;

/** How the parts of an address are told apart (postal-address.utils): the order of the Rules, cl. 32. */
export const POSTAL_ADDRESS_PATTERNS = {
  region: /(^|\s)(обл\.|область|АР Крим|Автономна Республіка Крим)(\s|$)/i,
  district: /(^|\s)(р-н|район)(\s|$)/i,
  country: /^Україна$/i,
  locality: /^(м\.|місто|с\.|село|смт|селище|сел\.|с-ще|с\.\s?м\.\s?т\.|хут\.|хутір)(\s|$)/i,
  street:
    /^(вул\.|вулиця|просп\.|проспект|пр-т|пров\.|провулок|бульв\.|бульвар|б-р|пл\.|площа|шосе|узвіз|набережна|наб\.|майдан|алея|тупик|проїзд|квартал|кв-л|мкрн|мікрорайон|дорога|лінія|в'їзд|в’їзд|спуск)(\s|$)/i,
  building:
    /^(буд\.|будинок|корп\.|корпус|кв\.|квартира|оф\.|офіс|прим\.|приміщення|к\.)?\s*\d+[\p{L}\d/-]*$|^(буд\.|корп\.|кв\.|оф\.|прим\.)\s*\S+$/iu,
} as const;
