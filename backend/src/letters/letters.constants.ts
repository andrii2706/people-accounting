/** Document titles of the outgoing letter types. */
export const LETTER_TYPE_TITLES = {
  CHANGE_NOTICE: 'Повідомлення про зміну облікових даних',
  LISTS: 'Списки персонального військового обліку',
  OPERATIONAL_REPORT: 'Відомість оперативного обліку',
  OTHER: 'Лист',
} as const;

/** A notice entered by hand (sent before the system) has no document here. */
export const EXTERNAL_NO_DOCUMENT = 'Повідомлення внесено вручну — його надіслано поза системою, документа тут немає';

/** Labels for at most this many letters in one file / print. */
export const LABELS_MAX_LETTERS = 200;
