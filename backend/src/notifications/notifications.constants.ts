/** How many days before the end of a deferral / reservation the reminder is sent. */
export const REMIND_DAYS_BEFORE = 5;

/** Remind to check the decrees this many days before the mobilization term ends. */
export const MOBILIZATION_REMIND_DAYS = 14;

/** Colours of the letter with a temporary password (the app palette). */
export const ACCESS_LETTER_COLORS = {
  page: '#e9e8e2',
  ink: '#1b1f17',
  muted: '#5d6356',
  line: '#e4e3dc',
  brand: '#4f5f37',
  brandDark: '#3e4b2c',
  brandLight: '#e8eddc',
  brandSoft: '#c8d4a8',
  brandPale: '#f3f6ec',
  warning: '#b54708',
  warningPale: '#fdf9f2',
} as const;

/** The link in the «password expires» letter is valid for a week (the letter comes a month before). */
export const PASSWORD_REMINDER_LINK_HOURS = 7 * 24;

/** Every extension of general mobilization so far — for 90 days (the decrees, approved by the Verkhovna Rada). */
export const MOBILIZATION_EXTENSION_DAYS = 90;

export const MOBILIZATION_ESTIMATED_NOTE = 'очікується указ — продовжено автоматично на 90 діб';

/** Genitive month names as decrees write them («31 жовтня 2026 року»). */
export const UA_MONTHS_GENITIVE: Record<string, number> = {
  січня: 1,
  лютого: 2,
  березня: 3,
  квітня: 4,
  травня: 5,
  червня: 6,
  липня: 7,
  серпня: 8,
  вересня: 9,
  жовтня: 10,
  листопада: 11,
  грудня: 12,
};

/**
 * The fallback source of the mobilization term: the list of presidential decrees. zakon.rada.gov.ua does not
 * always answer requests from outside Ukraine (the API runs in Google Cloud), president.gov.ua does.
 */
export const DECREE_FALLBACK_URL_DEFAULT = 'https://www.president.gov.ua/documents/decrees';
/** The extension decree comes out shortly before the term ends: the list is searched from this many days before it. */
export const DECREE_SEARCH_BEFORE_END_DAYS = 60;
/** With no known term — this far back. */
export const DECREE_SEARCH_WITHOUT_TERM_DAYS = 150;
/** At most this many pages of the list (20 decrees each) per check. */
export const DECREE_LIST_MAX_PAGES = 20;
/** One request to a decree site. */
export const DECREE_FETCH_TIMEOUT_MS = 20_000;
export const DECREE_USER_AGENT = 'military-registry/1.0 (mobilization term check)';

/** The e-mail about the end of the quota decision comes this many days before it. */
export const QUOTA_EXPIRING_DAYS = 14;

/** How many recalculations of the quota the quota page lists. */
export const QUOTA_HISTORY_LIMIT = 50;
