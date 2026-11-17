import {
  ChangeDetectionStrategy,
  Component,
  computed,
  afterNextRender,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { MenuAction, MenuPosition } from '../../interfaces/ui.interface';
import { menuPosition, orderedActions } from '../../utils/menu.utils';
import { IconComponent } from '../icon/icon.component';

/** Only one row menu is open at a time (a table cell may stop the click that would close the other). */
let openMenu: ActionsMenuComponent | null = null;

/**
 * The «⋯» menu of a table row instead of a row of buttons: actions, pages and files of one record.
 * Keyboard: Enter / Space / ↓ open it, ↑ ↓ Home End move, Esc closes, Tab leaves.
 * The menu is fixed to the window, so a table that scrolls sideways does not cut it off; it follows its button.
 */
@Component({
  selector: 'app-actions-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, IconComponent],
  host: {
    class: 'inline-block',
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'place()',
  },
  templateUrl: './actions-menu.component.html',
})
export class ActionsMenuComponent {
  readonly actions = input.required<readonly MenuAction[]>();
  /** For screen readers and the tooltip: «Дії: Олена Вигадана». */
  readonly label = input('Дії');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly open = signal(false);
  protected readonly position = signal<MenuPosition>({ right: 0, top: 0, bottom: null });
  protected readonly items = computed(() => orderedActions(this.actions()));
  /** The divider goes before the first destructive item (when something stands before it). */
  protected readonly dividerAt = computed(() => {
    const index = this.items().findIndex((a) => a.danger);
    return index > 0 ? index : -1;
  });
  protected readonly menuId = `menu-${Math.random().toString(36).slice(2, 9)}`;

  /** The page or the table scrolled: the menu follows its button, and closes once the button is out of sight. */
  private readonly onScroll = (event: Event) => {
    if (!this.panel()?.nativeElement.contains(event.target as Node)) this.place();
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  protected toggle() {
    if (this.open()) this.close(true);
    else this.show();
  }

  private show(focus: 'first' | 'last' = 'first') {
    if (!this.items().length) return;
    openMenu?.close();
    openMenu = this;
    this.open.set(true);
    this.place();
    document.addEventListener('scroll', this.onScroll, true);
    afterNextRender(() => this.focusItem(focus === 'first' ? 0 : -1), {
      injector: this.injector,
    });
  }

  protected place() {
    if (!this.open()) return;
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    )
      return this.close();
    this.position.set(menuPosition(rect, { width: window.innerWidth, height: window.innerHeight }));
  }

  close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (openMenu === this) openMenu = null;
    document.removeEventListener('scroll', this.onScroll, true);
    if (refocus) this.trigger().nativeElement.focus({ preventScroll: true });
  }

  protected select(action: MenuAction) {
    if (action.disabled) return;
    // a page or a file: the link does the work; an action — after the menu is closed (it may ask to confirm)
    this.close(!action.link && !action.href);
    action.run?.();
  }

  protected onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) this.show(event.key === 'ArrowUp' ? 'last' : 'first');
    }
  }

  protected onMenuKeydown(event: KeyboardEvent) {
    const items = this.enabledItems();
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusItem(current < 0 ? 0 : (current + 1) % items.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusItem(current <= 0 ? items.length - 1 : current - 1);
        break;
      case 'Home':
        event.preventDefault();
        this.focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusItem(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  protected onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private enabledItems(): HTMLElement[] {
    const panel = this.panel()?.nativeElement;
    return panel
      ? [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')]
      : [];
  }

  /** -1 — the last one. */
  private focusItem(index: number) {
    // without scrolling: the menu stands inside a table that scrolls sideways, and its scroll would close it
    this.enabledItems().at(index)?.focus({ preventScroll: true });
  }
}
