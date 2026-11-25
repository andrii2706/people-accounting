import { of, throwError } from 'rxjs';
import { EmployeesService } from '../../shared/services/employees.service';
import { listItem } from '../../testing/fixtures.testing';
import { renderPage } from '../../testing/page.testing';
import { CommandPaletteComponent } from './command-palette.component';

type State = {
  query: () => string;
  entries: () => { id: string; title: string; hint: string; go: () => void }[];
  peopleCount: () => number;
  active: () => number;
  searching: () => boolean;
  onInput: (v: string) => void;
  onKeydown: (e: KeyboardEvent) => void;
  pick: (e: { go: () => void }) => void;
};

const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true });

function render() {
  const employees = {
    list: vi.fn(() =>
      of({
        items: [
          listItem({
            id: 'e1',
            fullName: 'Вигаданий Петро',
            personnelNumber: '17',
            dismissalDate: '2026-01-01',
          } as never),
        ],
        total: 1,
      }),
    ),
  };
  const page = renderPage<CommandPaletteComponent, State>(CommandPaletteComponent, {
    providers: [{ provide: EmployeesService, useValue: employees }],
  });
  const closed = vi.fn();
  page.fixture.componentInstance.closed.subscribe(closed);
  return { ...page, employees, closed };
}

describe('CommandPaletteComponent — пошук Ctrl K', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('без запиту — швидкі дії; фільтр дій за назвою', () => {
    const { s } = render();
    expect(s.entries().length).toBe(8);
    s.onInput('и');
    expect(s.entries().every((e) => e.title.toLowerCase().includes('и'))).toBe(true);
  });

  it('пошук працівників після паузи; перехід до картки', async () => {
    const { s, employees, navigate, closed } = render();
    s.onInput('Ви');
    s.onInput('Вигад');
    await vi.advanceTimersByTimeAsync(250);
    expect(employees.list).toHaveBeenCalledTimes(1);
    expect(employees.list).toHaveBeenCalledWith({ search: 'Вигад', status: 'all' });
    expect(s.peopleCount()).toBe(1);
    expect(s.entries()[0].hint).toContain('таб. 17');
    expect(s.entries()[0].hint).toContain('звільнений');
    s.onKeydown(key('Enter'));
    expect(closed).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/employees', 'e1']);
  });

  it('помилка пошуку — порожньо; короткий запит — без пошуку', async () => {
    const { s, employees } = render();
    employees.list.mockReturnValueOnce(throwError(() => new Error('offline')) as never);
    s.onInput('Вигад');
    await vi.advanceTimersByTimeAsync(250);
    expect(s.peopleCount()).toBe(0);
    expect(s.searching()).toBe(false);
    s.onInput('В');
    expect(s.peopleCount()).toBe(0);
  });

  it('стрілки по колу; Escape закриває; кожна дія веде на свою сторінку', () => {
    const { s, navigate, closed } = render();
    s.onKeydown(key('ArrowUp'));
    expect(s.active()).toBe(7);
    s.onKeydown(key('ArrowDown'));
    expect(s.active()).toBe(0);
    s.onKeydown(key('Escape'));
    expect(closed).toHaveBeenCalledTimes(1);
    for (const e of s.entries()) s.pick(e);
    expect(navigate).toHaveBeenCalledTimes(8);
    s.onInput('щось зовсім інше');
    s.onKeydown(key('ArrowDown'));
    s.onKeydown(key('ArrowUp'));
    expect(s.active()).toBe(0);
    s.onKeydown(key('Enter'));
  });
});
