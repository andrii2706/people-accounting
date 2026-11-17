/** «п. Галино» — the polite address in letters and on the screen (пане / пані). */
export const ADDRESS_PREFIX = 'п.';

/** «Іванович», «Іванівна», «Миколаївна», «Ілліч», «Кузьмич»… — a patronymic follows the given name. */
export const PATRONYMIC = /(ович|евич|йович|івна|ївна|овна|ична|інічна|ілліч|ьмич)$/iu;

/**
 * Typical surname endings: «Петренко», «Ковальчук», «Литвинюк», «Грушевський», «Котляревська», «Петрів»,
 * «Коваляк», «Іванова», «Смирнов»… Given names do not end like this («Марко», «Лев», «Яків», «Єва» are not matched).
 */
export const SURNAME =
  /(енко|ук|юк|ський|цький|зький|ська|цька|зька|ович|евич|ишин|ишина|(?<=\p{L}{3})(ова|ева|єва|ов|ев|єв|ів|як))$/iu;

/** A given name the library can decline: Ukrainian letters (with an apostrophe or a hyphen). */
export const UKRAINIAN_WORD = /^[А-ЩЬЮЯҐЄІЇа-щьюяґєії'’ʼ-]+$/u;

/** Accounts named after a role, not a person («Адміністратор», «Директор») — no «п. Адміністраторе». */
export const NOT_A_GIVEN_NAME =
  /^(адміністратор|адмін|директор|керівник|бухгалтер|кадровик|інспектор|відповідальний|користувач|оператор|тест|тестовий)$/iu;
