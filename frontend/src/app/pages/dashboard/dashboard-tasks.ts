import type { InboxItem } from '../../shared/interfaces/inbox.interface';

/** One line of «Що зробити сьогодні»: several notifications can be one task (e.g. all TCK notices). */
export interface DashboardTask {
  key: string;
  level: 'danger' | 'warning';
  title: string;
  detail: string;
  action: string;
  link: string[];
  query?: Record<string, string>;
}

/** An upcoming term for «Строки на 30 днів». */
export interface UpcomingTerm {
  key: string;
  date: string;
  title: string;
  employeeName: string;
  employeeId: string;
}

const short = (fullName: string) => {
  const [last, first, middle] = fullName.split(' ');
  return [last, first && `${first[0]}.`, middle && `${middle[0]}.`].filter(Boolean).join(' ');
};

/** The key of a notification is «CODE:employeeId:ref» (see the backend InboxService). */
export function parseKey(key: string): { code: string; ref: string } {
  const [code, , ref = ''] = key.split(':');
  return { code, ref };
}

const CARD_GROUPS: Record<string, { title: (n: number) => string; detail: string }> = {
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

const PER_EMPLOYEE: Record<
  string,
  { title: (name: string) => string; action: string; edit?: boolean }
> = {
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

/** Builds the task list from the current notifications: most urgent first. */
export function buildTasks(items: InboxItem[]): DashboardTask[] {
  const tasks: DashboardTask[] = [];

  const tck = items.filter((i) => i.kind === 'TCK');
  if (tck.length) {
    const overdue = tck.filter((i) => i.level === 'danger').length;
    const names = [...new Set(tck.map((i) => short(i.employeeName)))];
    tasks.push({
      key: 'TCK',
      level: overdue ? 'danger' : 'warning',
      title: `Надіслати ${tck.length} ${tck.length === 1 ? 'повідомлення' : 'повідомлень'} у ТЦК`,
      detail:
        names.slice(0, 3).join(', ') +
        (names.length > 3 ? ` і ще ${names.length - 3}` : '') +
        (overdue ? ` · прострочено: ${overdue}` : ''),
      action: 'Сформувати лист',
      link: ['/notifications'],
    });
  }

  for (const item of items) {
    const { code } = parseKey(item.key);
    const rule = PER_EMPLOYEE[code];
    if (!rule) continue;
    tasks.push({
      key: item.key,
      level: item.level === 'danger' ? 'danger' : 'warning',
      title: rule.title(short(item.employeeName)),
      detail: item.message,
      action: rule.action,
      link: rule.edit ? ['/employees', item.employeeId, 'edit'] : ['/employees', item.employeeId],
    });
  }

  for (const [code, group] of Object.entries(CARD_GROUPS)) {
    const n = items.filter((i) => parseKey(i.key).code === code).length;
    if (!n) continue;
    tasks.push({
      key: code,
      level: 'warning',
      title: group.title(n),
      detail: group.detail,
      action: `Показати ${n}`,
      link: ['/employees'],
      query: { view: 'attention' },
    });
  }

  return tasks.sort((a, b) => Number(a.level !== 'danger') - Number(b.level !== 'danger'));
}

const TERM_TITLES: Record<string, string> = {
  RESERVATION_EXPIRING: 'Бронювання',
  DEFERRAL_EXPIRING: 'Відстрочка',
  VLK_SOON: 'ВЛК',
};

/** Terms within the alert window (the backend only warns about those), soonest first. */
export function upcomingTerms(items: InboxItem[]): UpcomingTerm[] {
  return items
    .map((i) => ({ i, ...parseKey(i.key) }))
    .filter(({ code, ref }) => TERM_TITLES[code] && /^\d{4}-\d{2}-\d{2}$/.test(ref))
    .map(({ i, code, ref }) => ({
      key: i.key,
      date: ref,
      title: TERM_TITLES[code],
      employeeName: short(i.employeeName),
      employeeId: i.employeeId,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
