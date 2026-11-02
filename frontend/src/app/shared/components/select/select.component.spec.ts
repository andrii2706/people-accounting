import { TestBed } from '@angular/core/testing';
import type { SelectOption } from '../../interfaces/ui.interface';
import { SelectComponent } from './select.component';

const RANKS: SelectOption[] = [
  'солдат',
  'сержант',
  'лейтенант',
  'капітан',
  'майор',
  'підполковник',
  'полковник',
  'генерал',
  'рекрут',
].map((label, i) => ({ value: String(i), label }));

function setup(options: SelectOption[], value = '') {
  const fixture = TestBed.createComponent(SelectComponent);
  fixture.componentRef.setInput('options', options);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const combobox = el.querySelector('[role="combobox"]') as HTMLButtonElement;
  const open = () => {
    combobox.click();
    fixture.detectChanges();
  };
  const options$ = () => [...el.querySelectorAll<HTMLElement>('[role="option"]')];
  const key = (k: string) => {
    combobox.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    fixture.detectChanges();
  };
  return {
    fixture,
    el,
    combobox,
    open,
    options: options$,
    key,
    value: () => fixture.componentInstance.value(),
  };
}

describe('SelectComponent', () => {
  // jsdom has no layout: the active option is scrolled into view only in a real browser
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => undefined;
  });

  it('показує підпис обраного значення', () => {
    const t = setup(RANKS.slice(0, 3), '1');
    expect(t.combobox.textContent).toContain('сержант');
  });

  it('вибір мишею змінює значення і закриває список', () => {
    const t = setup(RANKS.slice(0, 3));
    t.open();
    t.options()
      .find((o) => o.textContent?.includes('лейтенант'))!
      .click();
    t.fixture.detectChanges();
    expect(t.value()).toBe('2');
    expect(t.options()).toHaveLength(0);
  });

  it('пункт «—» очищає значення', () => {
    const t = setup(RANKS.slice(0, 3), '1');
    t.open();
    t.options()[0].click();
    expect(t.value()).toBe('');
  });

  it('пошук з’являється, коли варіантів більше 8, і фільтрує список', () => {
    const t = setup(RANKS);
    t.open();
    const search = t.el.querySelector('input[aria-label="Пошук у списку"]') as HTMLInputElement;
    expect(search).toBeTruthy();
    search.value = 'полк';
    search.dispatchEvent(new Event('input'));
    t.fixture.detectChanges();
    expect(t.options().map((o) => o.textContent?.trim())).toEqual(['підполковник', 'полковник']);
  });

  it('клавіатура: стрілки і Enter', () => {
    const t = setup(RANKS.slice(0, 3));
    t.key('ArrowDown'); // opens
    t.key('ArrowDown');
    t.key('Enter');
    expect(t.value()).toBe('1');
  });

  it('вимкнений список не відкривається', () => {
    const t = setup(RANKS.slice(0, 3));
    t.fixture.componentRef.setInput('disabled', true);
    t.fixture.detectChanges();
    t.open();
    expect(t.options()).toHaveLength(0);
  });
});
