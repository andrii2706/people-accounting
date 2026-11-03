import type { InboxItem } from '../interfaces/inbox.interface';
import type { DashboardTask, InboxKeyParts, UpcomingTerm } from '../interfaces/report.interface';
import { CARD_GROUPS, PER_EMPLOYEE, TERM_TITLES } from '../constants/dashboard.constants';

const short = (fullName: string) => {
  const [last, first, middle] = fullName.split(' ');
  return [last, first && `${first[0]}.`, middle && `${middle[0]}.`].filter(Boolean).join(' ');
};

/** The key of a notification is «CODE:employeeId:ref» (see the backend InboxService). */
export function parseKey(key: string): InboxKeyParts {
  const [code, , ref = ''] = key.split(':');
  return { code, ref };
}

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
