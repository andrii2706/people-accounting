/** Max size of an uploaded .p7s signature. */
export const MAX_SIGNATURE_BYTES = 700 * 1024;

/** Public key types in a certificate (EU_CERT_KEY_TYPE_*). */
export const CERT_KEY_TYPE = { DSTU4145: 1, RSA: 2, ECDSA: 4 } as const;

/** EU_KEY_USAGE_DIGITAL_SIGNATURE — a signing certificate (not an encryption one). */
export const CERT_KEY_USAGE_SIGNATURE = 1;

/** Where to sign a downloaded file with KEP without the widget. */
export const KEP_SIGN_TOOLS = [
  { label: 'Дія.Підпис (id.gov.ua/sign)', url: 'https://id.gov.ua/sign' },
  { label: 'czo.gov.ua/sign', url: 'https://czo.gov.ua/sign' },
];
