/** Is there Ukrainian (Cyrillic) text — i.e. a message written for people. */
export const hasCyrillic = (s: unknown) => typeof s === 'string' && /[а-яіїєґ]/i.test(s);

/** The number from a standard class-validator message («… shorter than or equal to 100 characters»). */
export const numberIn = (raw: string) => /(-?\d+(?:\.\d+)?)/.exec(raw)?.[1] ?? '';
