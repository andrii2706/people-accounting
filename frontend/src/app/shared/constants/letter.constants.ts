import type {
  ExternalNoticeForm,
  ExternalNoticeType,
  LetterType,
} from '../interfaces/letter.interface';
import type { SelectOption } from '../interfaces/ui.interface';
export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  CHANGE_NOTICE: 'Повідомлення про зміну даних',
  LISTS: 'Списки (Дод. 5)',
  OPERATIONAL_REPORT: 'Відомість (Дод. 12)',
  OTHER: 'Інше',
};

/** What an old (paper) notice reported. */
export const EXTERNAL_NOTICE_TYPES: SelectOption<ExternalNoticeType>[] = [
  { value: 'HIRE', label: 'Прийняття на роботу' },
  { value: 'POSITION', label: 'Переведення / зміна посади' },
  { value: 'DISMISSAL', label: 'Звільнення з роботи' },
  { value: 'DATA', label: 'Зміна облікових даних' },
];

export const EMPTY_EXTERNAL_NOTICE: ExternalNoticeForm = {
  number: '',
  date: '',
  changeType: 'HIRE',
  effectiveDate: '',
  tckId: '',
  description: '',
};

/** The page «Повідомлення ТЦК»: combined letters by TCK (or one card per employee) — remembered per browser. */
export const NOTICES_GROUPED_KEY = 'oblik-notices-grouped';
