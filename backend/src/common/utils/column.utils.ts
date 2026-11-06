import type { ValueTransformer } from 'typeorm';

/** Postgres `numeric` comes back as a string — read it as a number (null stays null). */
export const decimalColumn: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
