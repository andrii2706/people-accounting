/** Outgoing letter type names for the UI. */
import type { LetterType } from '../interfaces/letter.interface';
export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  CHANGE_NOTICE: 'Повідомлення про зміну даних',
  LISTS: 'Списки (Дод. 5)',
  OPERATIONAL_REPORT: 'Відомість (Дод. 12)',
  OTHER: 'Інше',
};
