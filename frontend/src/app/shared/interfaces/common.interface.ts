export type Gender = 'M' | 'F';

export interface Warning {
  code: string;
  level: 'danger' | 'warning' | 'info';
  message: string;
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

/** Error of one field in an API response (400): `field` is the path in the request body. */
export interface ApiFieldError {
  /** "postalCode", "militaryDocuments.0.number". */
  field: string;
  message: string;
  /** Human name of the field: «Поштовий індекс». */
  label?: string;
}

/** Body of an API error (NestJS + HttpExceptionFilter). */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  errors?: ApiFieldError[];
  code?: string;
}

/** Result of binding API errors to a form: what went under fields and what is left for a common message. */
export interface BoundApiErrors<E> {
  fieldErrors: E[];
  unmatched: string[];
}
