import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

export interface SelectOption {
  value: string;
  label: string;
  /** Second line in the list (e.g. the composition of a rank). */
  hint?: string;
}

/**
 * Drop-down list in the style of the app (instead of the native <select>): search for long lists,
 * keyboard (↑ ↓ Enter Esc, typing to search), clearing. Works with [formField] of Signal Forms.
 */
@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './select.component.html',
})
export class SelectComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly options = input<readonly SelectOption[]>([]);
  readonly placeholder = input('Оберіть…');
  /** Search box in the list; by default — when there are more than 8 options. */
  readonly searchable = input<boolean | undefined>(undefined);
  /** The «—» item that clears the value. */
  readonly clearable = input(true);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();
  readonly ariaLabel = input<string | undefined>(undefined);

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly listId = `select-${Math.random().toString(36).slice(2, 9)}`;

  protected readonly selected = computed(() =>
    this.options().find((o) => o.value === this.value()),
  );
  protected readonly showSearch = computed(() => this.searchable() ?? this.options().length > 8);
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    return q
      ? all.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
      : all;
  });

  focus(options?: FocusOptions) {
    this.button().nativeElement.focus(options);
  }

  protected toggle() {
    if (this.open()) this.close();
    else this.show();
  }

  private show() {
    if (this.disabled() || this.readonly()) return;
    this.query.set('');
    const index = this.options().findIndex((o) => o.value === this.value());
    this.active.set(Math.max(index, 0));
    this.open.set(true);
    queueMicrotask(() => {
      this.searchInput()?.nativeElement.focus();
      this.scrollActive();
    });
  }

  close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    this.touch.emit();
    if (refocus) this.focus();
  }

  protected pick(value: string) {
    this.value.set(value);
    this.close(true);
  }

  protected onKeydown(event: KeyboardEvent) {
    const list = this.filtered();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) return this.show();
        this.active.update((i) => Math.min(i + 1, list.length - 1));
        this.scrollActive();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.update((i) => Math.max(i - 1, 0));
        this.scrollActive();
        break;
      case 'Enter':
        if (!this.open()) return;
        event.preventDefault();
        if (list[this.active()]) this.pick(list[this.active()].value);
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          event.stopPropagation();
          this.close(true);
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  protected onQuery(value: string) {
    this.query.set(value);
    this.active.set(0);
  }

  private scrollActive() {
    queueMicrotask(() =>
      this.root()
        .nativeElement.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }

  protected onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.root().nativeElement.contains(event.target as Node)) this.close();
  }
}
