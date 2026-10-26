declare module 'gost89' {
  /** ГОСТ 34.311-95 з таблицею замін ДКЕ №1 (як у вітчизняних КЕП). */
  export function gosthash(data: Uint8Array): Uint8Array;
  const gost89: { gosthash: typeof gosthash };
  export default gost89;
}
