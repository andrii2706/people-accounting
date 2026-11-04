/** A country in the phone field: the dialling code (digits only) and the name. */
export interface PhoneCountry {
  code: string;
  iso: string;
  name: string;
  /** Digits of the national number: an example for the placeholder. */
  example: string;
}

/** A stored phone split for the field: the country code and the national digits. */
export interface PhoneParts {
  code: string;
  national: string;
}
