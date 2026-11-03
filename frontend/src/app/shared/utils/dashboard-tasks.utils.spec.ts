import type { InboxItem } from '../interfaces/inbox.interface';
import { buildTasks, parseKey, upcomingTerms } from './dashboard-tasks.utils';

const item = (key: string, patch: Partial<InboxItem> = {}): InboxItem => ({
  key,
  kind: 'CARD',
  level: 'warning',
  employeeId: key.split(':')[1] ?? 'e1',
  employeeName: 'Приклад Петро Іванович',
  message: 'текст',
  link: 'EMPLOYEE',
  read: false,
  ...patch,
});

describe('огляд: «Що зробити сьогодні»', () => {
  it('ключ сповіщення: код і дата', () => {
    expect(parseKey('VLK_SOON:e1:2026-11-08')).toEqual({ code: 'VLK_SOON', ref: '2026-11-08' });
    expect(parseKey('NO_TCK:e1:')).toEqual({ code: 'NO_TCK', ref: '' });
  });

  it('усі повідомлення ТЦК — одна справа, прострочені роблять її терміновою', () => {
    const tasks = buildTasks([
      item('TCK:c1:new', { kind: 'TCK', employeeName: 'Бондар Віталій Романович' }),
      item('TCK:c2:overdue', {
        kind: 'TCK',
        level: 'danger',
        employeeName: 'Гнатюк Тарас Миронович',
      }),
    ]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ key: 'TCK', level: 'danger', link: ['/notifications'] });
    expect(tasks[0].title).toBe('Надіслати 2 повідомлень у ТЦК');
    expect(tasks[0].detail).toContain('Бондар В. Р., Гнатюк Т. М.');
  });

  it('картки без ТЦК групуються; термінові справи — першими', () => {
    const tasks = buildTasks([
      item('NO_TCK:e1:'),
      item('NO_TCK:e2:'),
      item('AGE_LIMIT:e3:1966-01-01', { level: 'danger' }),
    ]);
    expect(tasks.map((t) => t.title)).toEqual([
      'Зняти з обліку за віком: Приклад П. І.',
      '2 картки без ТЦК',
    ]);
    expect(tasks[1]).toMatchObject({ link: ['/employees'], query: { view: 'attention' } });
  });

  it('строки — лише ті, що наближаються, від найближчого', () => {
    const terms = upcomingTerms([
      item('VLK_SOON:e1:2026-11-20'),
      item('RESERVATION_EXPIRING:e2:2026-11-15'),
      item('DEFERRAL_EXPIRED:e3:2026-10-01'),
    ]);
    expect(terms.map((t) => [t.title, t.date])).toEqual([
      ['Бронювання', '2026-11-15'],
      ['ВЛК', '2026-11-20'],
    ]);
  });
});
