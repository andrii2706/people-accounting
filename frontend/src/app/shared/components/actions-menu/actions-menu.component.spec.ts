import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MenuAction } from '../../interfaces/ui.interface';
import { ActionsMenuComponent } from './actions-menu.component';

function setup(actions: MenuAction[]) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ActionsMenuComponent);
  fixture.componentRef.setInput('actions', actions);
  fixture.componentRef.setInput('label', 'Дії: Олена Вигадана');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const trigger = el.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
  const items = () => [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const flush = () => new Promise<void>((r) => queueMicrotask(r));
  return {
    fixture,
    el,
    trigger,
    items,
    async open() {
      trigger.click();
      fixture.detectChanges();
      await flush();
    },
    key(k: string) {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true }),
      );
      fixture.detectChanges();
    },
  };
}

describe('меню «⋯» рядка таблиці', () => {
  it('закрите — лише кнопка з назвою для екранних читачів', () => {
    const { trigger, items } = setup([{ label: 'Редагувати' }]);
    expect(trigger.getAttribute('aria-label')).toBe('Дії: Олена Вигадана');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(items()).toEqual([]);
  });

  it('пункт виконує дію й закриває меню', async () => {
    const run = vi.fn();
    const { open, items, fixture, trigger } = setup([{ label: 'Скинути пароль', run }]);
    await open();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    items()[0].click();
    fixture.detectChanges();
    expect(run).toHaveBeenCalledOnce();
    expect(items()).toEqual([]);
  });

  it('недоступний пункт видно з причиною, але він нічого не робить', async () => {
    const run = vi.fn();
    const { open, items } = setup([
      {
        label: 'Видалити юрособу',
        danger: true,
        disabled: true,
        hint: 'Спершу переведіть працівників',
        run,
      },
    ]);
    await open();
    expect(items()[0].getAttribute('aria-disabled')).toBe('true');
    expect(items()[0].textContent).toContain('Спершу переведіть працівників');
    items()[0].click();
    expect(run).not.toHaveBeenCalled();
  });

  it('небезпечна дія — остання, за роздільником', async () => {
    const { open, items, el } = setup([
      { label: 'Заблокувати', danger: true },
      { label: 'Редагувати' },
    ]);
    await open();
    expect(items().map((i) => i.textContent?.trim())).toEqual(['Редагувати', 'Заблокувати']);
    expect(el.querySelector('[role="separator"]')).not.toBeNull();
  });

  it('клавіатура: фокус на першому пункті, ↓ ↑ по колу, Esc повертає на кнопку', async () => {
    const { open, items, key, trigger, el } = setup([
      { label: 'Редагувати' },
      { label: 'Недоступно', disabled: true },
      { label: 'Скинути пароль' },
    ]);
    document.body.appendChild(el);
    await open();
    expect(document.activeElement).toBe(items()[0]);
    key('ArrowDown');
    expect(document.activeElement).toBe(items()[2]); // the disabled one is skipped
    key('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    key('ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    key('Escape');
    expect(items()).toEqual([]);
    expect(document.activeElement).toBe(trigger);
    el.remove();
  });

  it('клік поза меню закриває його', async () => {
    const { open, items, fixture } = setup([{ label: 'Редагувати' }]);
    await open();
    document.body.click();
    fixture.detectChanges();
    expect(items()).toEqual([]);
  });
});
