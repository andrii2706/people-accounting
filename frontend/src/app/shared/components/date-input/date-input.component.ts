import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { MONTH_NAMES, WEEKDAY_NAMES } from '../../constants/date.constants';
import type { CalendarCell } from '../../interfaces/ui.interface';
import { displayToIso, isIso, isoToDisplay, maskDateInput, toIso } from '../../utils/date.utils';

/**
 * Date field in the Ukrainian format ДД.ММ.РРРР with a calendar — the same on every browser
 * (the native <input type="date"> shows mm/dd/yyyy in an English browser).
 * The value is ISO «РРРР-ММ-ДД» (or the typed text while it is not a valid date).
 */
@Component({
  selector: 'app-date-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
  },
  templateUrl: './date-input.component.html',
})
export class DateInputComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();
  readonly placeholder = input('ДД.ММ.РРРР');
  /** Accessible name when there is no visible <label for>. */
  readonly ariaLabel = input<string | undefined>(undefined);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly textInput = viewChild.required<ElementRef<HTMLInputElement>>('textField');

  protected readonly weekdays = WEEKDAY_NAMES;
  protected readonly months = MONTH_NAMES;
  protected readonly open = signal(false);
  protected readonly text = linkedSignal(() => isoToDisplay(this.value()));

  /** Month shown in the calendar: of the value, otherwise the current one. */
  protected readonly view = linkedSignal(() => {
    const v = this.value();
    const base = isIso(v) ? new Date(`${v}T00:00:00Z`) : new Date();
    return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
  });
  protected readonly years = computed(() => {
    const now = new Date().getFullYear();
    const from = Math.min(1930, this.view().year);
    const to = Math.max(now + 10, this.view().year);
    return Array.from({ length: to - from + 1 }, (_, i) => to - i);
  });
  protected readonly days = computed(() => {
    const { year, month } = this.view();
    const first = new Date(Date.UTC(year, month - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday first
    const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today = new Date();
    const todayIso = toIso(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const cells: CalendarCell[] = [];
    for (let d = 1; d <= total; d++) {
      const iso = toIso(year, month, d);
      cells.push({ day: d, iso, today: iso === todayIso, selected: iso === this.value() });
    }
    return { offset: Array.from({ length: offset }), cells };
  });

  focus(options?: FocusOptions) {
    this.textInput().nativeElement.focus(options);
  }

  protected onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const masked = maskDateInput(input.value);
    input.value = masked;
    this.text.set(masked);
    this.value.set(masked ? displayToIso(masked) : '');
  }

  protected onBlur() {
    this.touch.emit();
  }

  protected toggle() {
    if (this.disabled() || this.readonly()) return;
    this.open.update((v) => !v);
  }

  close() {
    this.open.set(false);
  }

  protected pick(iso: string) {
    this.value.set(iso);
    this.close();
    this.touch.emit();
    this.focus();
  }

  protected shift(months: number) {
    this.view.update(({ year, month }) => {
      const index = year * 12 + (month - 1) + months;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  protected setMonth(month: string) {
    this.view.update((v) => ({ ...v, month: Number(month) }));
  }

  protected setYear(year: string) {
    this.view.update((v) => ({ ...v, year: Number(year) }));
  }

  protected today() {
    const now = new Date();
    this.pick(toIso(now.getFullYear(), now.getMonth() + 1, now.getDate()));
  }

  protected clear() {
    this.value.set('');
    this.close();
    this.touch.emit();
  }

  protected onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.host().nativeElement.contains(event.target as Node)) this.close();
  }
}
