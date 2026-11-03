/** Days are whole numbers: «7,5» or «1e2» are not days. */
export const wholeDays = (v: number) =>
  v != null && !Number.isInteger(Number(v))
    ? { kind: 'integer', message: 'Ціле число днів' }
    : undefined;
