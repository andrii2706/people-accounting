import type { DashboardCardGroup, DashboardTaskMeta } from '../interfaces/report.interface';

/** Card problems grouped into one task with a count («3 картки без ТЦК»). */
export const CARD_GROUPS: Record<string, DashboardCardGroup> = {
  NO_TCK: {
    title: (n) => `${n} ${n === 1 ? 'картка' : n < 5 ? 'картки' : 'карток'} без ТЦК`,
    detail: 'Без ТЦК не вийде сформувати повідомлення',
  },
  NO_MIL_DOC: {
    title: (n) => `${n} без військово-облікового документа`,
    detail: 'Додайте ВОД або номер документа в картці',
  },
  NO_RANK: {
    title: (n) => `${n} без військового звання`,
    detail: 'Оберіть звання або «призовник»',
  },
};

/** Problems shown as one task per employee. */
export const PER_EMPLOYEE: Record<string, DashboardTaskMeta> = {
  AGE_LIMIT: { title: (n) => `Зняти з обліку за віком: ${n}`, action: 'Відкрити картку' },
  RESERVATION_EXPIRED: {
    title: (n) => `Бронювання закінчилося: ${n}`,
    action: 'Оновити',
    edit: true,
  },
  RESERVATION_EXPIRING: {
    title: (n) => `Бронювання закінчується: ${n}`,
    action: 'Продовжити',
    edit: true,
  },
  DEFERRAL_EXPIRED: { title: (n) => `Відстрочка закінчилася: ${n}`, action: 'Оновити', edit: true },
  DEFERRAL_EXPIRING: { title: (n) => `Відстрочка закінчується: ${n}`, action: 'Відкрити картку' },
  VLK_OVERDUE: { title: (n) => `Пропущена ВЛК: ${n}`, action: 'Оновити дати', edit: true },
  VLK_SOON: { title: (n) => `Наступна ВЛК: ${n}`, action: 'Відкрити картку' },
};

/** Titles of the «Строки найближчим часом» entries by notification code. */
export const TERM_TITLES: Record<string, string> = {
  RESERVATION_EXPIRING: 'Бронювання',
  DEFERRAL_EXPIRING: 'Відстрочка',
  VLK_SOON: 'ВЛК',
};
