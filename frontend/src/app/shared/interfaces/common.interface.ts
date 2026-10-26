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

export interface ApiError {
  statusCode: number;
  message: string | string[];
}
