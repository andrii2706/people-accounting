import type { PreviewRecruit } from '../../../../shared/interfaces/login-preview.interface';

/** The list on the sign-in page: made-up people, nothing from a real account. */
export const PREVIEW_PEOPLE: readonly PreviewRecruit[] = [
  {
    initials: 'ВП',
    name: 'Вигаданий Петро Іванович',
    rank: 'солдат · ВОС 100915',
    state: { text: 'заброньований', tone: 'blue' },
  },
  {
    initials: 'ГМ',
    name: 'Гаданенко Марта Олегівна',
    rank: 'мол. сержант · медична служба',
    state: { text: 'на обліку', tone: 'green' },
  },
  {
    initials: 'НО',
    name: 'Новенький Остап Романович',
    rank: 'призовник',
    state: { text: 'повідомити ТЦК', tone: 'amber' },
  },
];

/** The notice to the TCK in the corner of the picture. */
export const PREVIEW_NOTICE = {
  title: 'Повідомлення до ТЦК',
  text: 'Прийом на роботу · Новенький О. Р.',
  number: '№ 112 від 24.10.2026',
};

/** The chips: soft background, dark text (readable on the white card). */
export const PREVIEW_TONES: Record<string, string> = {
  blue: 'bg-[#e8f0f8] text-[#2a5d8f]',
  green: 'bg-[#e9f3ea] text-[#2f7a3b]',
  amber: 'bg-[#fbf0e4] text-[#9a4a0b]',
};
