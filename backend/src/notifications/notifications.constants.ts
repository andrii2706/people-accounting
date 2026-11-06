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
