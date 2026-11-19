import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { SelectOption } from '../../interfaces/ui.interface';

let nextId = 0;

/**
 * A text field with suggestions from a directory: pick one from the list (by any word of the name or the hint)
 * or type your own text — the value is the text either way. Arrows, Enter and Escape work as in a combobox.
 */
@Component({
  selector: 'app-suggest-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
  },
  template: `
    <input
      #field
      class="input"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      [attr.aria-expanded]="open() && matches().length > 0"
      [attr.aria-controls]="listId"
      [attr.aria-activedescendant]="open() && active() >= 0 ? listId + '-' + active() : null"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-label]="ariaLabel() ?? null"
      [placeholder]="placeholder()"
      [value]="value()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      (input)="onInput($event)"
      (focus)="onFocus()"
      (blur)="touch.emit()"
      (keydown)="onKeydown($event)"
    />
    @if (open() && matches().length) {
      <ul
        [id]="listId"
        role="listbox"
        class="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-lg"
      >
        @for (o of matches(); track o.value; let i = $index) {
          <li
            [id]="listId + '-' + i"
            role="option"
            class="cursor-pointer px-3 py-1.5"
            [class.bg-sunken]="i === active()"
            [attr.aria-selected]="i === active()"
            (mousedown)="$event.preventDefault()"
            (mouseenter)="active.set(i)"
            (click)="pick(o)"
          >
            <span class="block">{{ o.label }}</span>
            @if (o.hint) {
              <span class="block text-xs text-muted">{{ o.hint }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class SuggestInputComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();
  /** Suggestions: the label is put into the field; the hint (e.g. the town) helps to find it. */
  readonly options = input<readonly SelectOption[]>([]);
  readonly placeholder = input('');
  readonly ariaLabel = input<string | undefined>(undefined);
  /** How many suggestions are shown at most. */
  readonly limit = input(30);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly listId = `suggest-${++nextId}`;
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  /** Every word typed must be in the name or the hint: «шевч льв» → «Шевченківський … (м. Львів)». */
  protected readonly matches = computed(() => {
    const words = this.value().toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length
      ? this.options().filter((o) => {
          const text = `${o.label} ${o.hint ?? ''}`.toLowerCase();
          return words.every((w) => text.includes(w));
        })
      : this.options();
    // the exact value is already in the field — nothing to suggest
    if (list.length === 1 && list[0].label === this.value()) return [];
    return list.slice(0, this.limit());
  });

  focus(options?: FocusOptions) {
    this.field().nativeElement.focus(options);
  }

  protected onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
    this.open.set(true);
    this.active.set(-1);
  }

  protected onFocus() {
    if (!this.readonly() && !this.disabled()) this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent) {
    const n = this.matches().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!n) return;
      event.preventDefault();
      this.open.set(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.update((i) => (i + step + n) % n);
    } else if (event.key === 'Enter' && this.open() && this.active() >= 0 && this.active() < n) {
      event.preventDefault();
      this.pick(this.matches()[this.active()]);
    } else if (event.key === 'Escape' && this.open()) {
      event.stopPropagation();
      this.open.set(false);
    } else if (event.key === 'Tab') {
      this.open.set(false);
    }
  }

  protected pick(o: SelectOption) {
    this.value.set(o.label);
    this.open.set(false);
    this.active.set(-1);
    this.touch.emit();
  }

  protected onDocumentClick(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
