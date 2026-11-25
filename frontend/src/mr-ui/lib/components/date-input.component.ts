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
import { UI_MONTH_NAMES, UI_WEEKDAY_NAMES } from '../constants/date.constants';
import type { UiCalendarCell } from '../interfaces/date.interface';
import {
  uiDisplayToValue,
  uiMaskDateInput,
  uiSplitValue,
  uiTimeSlots,
  uiTodayIso,
  uiToIso,
  uiValueToDisplay,
} from '../utils/date.utils';

type View = 'days' | 'months' | 'years';

/**
 * The date field of every module: ДД.ММ.РРРР typed or picked in the calendar of the application — the same in every
 * browser (the native <input type="date"> shows mm/dd/yyyy and its own English calendar).
 * The value: «РРРР-ММ-ДД»; with `withTime` — «РРРР-ММ-ДДTГГ:ХХ» and a column of the hours next to the calendar.
 * A typed text that is not a real date stays the value, so the form can say «Некоректна дата».
 * The title of the calendar switches to the months and to the years (a birth date is three clicks away).
 */
@Component({
  selector: 'ui-date-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
  },
  template: `
    <div #root class="relative">
      <input
        #textField
        class="input w-full pr-10 tabular-nums"
        [class.input-error]="invalid()"
        inputmode="numeric"
        autocomplete="off"
        [attr.id]="inputId() || null"
        [attr.maxlength]="withTime() ? 16 : 10"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [placeholder]="placeholder() || (withTime() ? 'ДД.ММ.РРРР ГГ:ХХ' : 'ДД.ММ.РРРР')"
        [value]="text()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        (input)="onInput($event)"
        (blur)="touch.emit()"
        (keydown.alt.arrowdown)="toggle()"
      />
      <button
        type="button"
        class="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted hover:bg-base-300 hover:text-base-content disabled:cursor-default disabled:opacity-40"
        aria-label="Відкрити календар"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [disabled]="disabled() || readonly()"
        (click)="toggle()"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>

      @if (open()) {
        <div
          class="absolute z-50 mt-1 flex overflow-hidden rounded-xl border border-line bg-base-100 shadow-lg"
          [class.left-0]="align() === 'left'"
          [class.right-0]="align() === 'right'"
          role="dialog"
          aria-label="Вибір дати"
        >
          <div class="w-72 p-3">
            <div class="mb-2 flex items-center gap-1">
              <button
                type="button"
                class="flex-1 cursor-pointer rounded-md px-2 py-1 text-left text-sm font-semibold hover:bg-base-300"
                [attr.aria-label]="
                  view() === 'days'
                    ? 'Обрати місяць і рік'
                    : view() === 'months'
                      ? 'Обрати рік'
                      : 'Назад до днів'
                "
                (click)="switchView()"
              >
                {{ title() }}
                <span aria-hidden="true" class="text-muted">▾</span>
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-md p-1.5 hover:bg-base-300"
                [attr.aria-label]="
                  view() === 'years'
                    ? 'Попередні роки'
                    : view() === 'months'
                      ? 'Попередній рік'
                      : 'Попередній місяць'
                "
                (click)="shift(-1)"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-md p-1.5 hover:bg-base-300"
                [attr.aria-label]="
                  view() === 'years'
                    ? 'Наступні роки'
                    : view() === 'months'
                      ? 'Наступний рік'
                      : 'Наступний місяць'
                "
                (click)="shift(1)"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            @switch (view()) {
              @case ('years') {
                <div class="grid grid-cols-3 gap-1">
                  @for (y of years(); track y) {
                    <button
                      type="button"
                      class="cursor-pointer rounded-md py-2 text-sm tabular-nums"
                      [class]="
                        y === month().year
                          ? 'bg-primary font-semibold text-primary-content'
                          : 'hover:bg-base-300'
                      "
                      [attr.aria-pressed]="y === month().year"
                      (click)="pickYear(y)"
                    >
                      {{ y }}
                    </button>
                  }
                </div>
              }
              @case ('months') {
                <div class="grid grid-cols-3 gap-1">
                  @for (m of monthNames; track m; let i = $index) {
                    <button
                      type="button"
                      class="cursor-pointer rounded-md py-2 text-sm"
                      [class]="
                        i + 1 === month().month
                          ? 'bg-primary font-semibold text-primary-content'
                          : 'hover:bg-base-300'
                      "
                      [attr.aria-pressed]="i + 1 === month().month"
                      (click)="pickMonth(i + 1)"
                    >
                      {{ m.slice(0, 3) }}
                    </button>
                  }
                </div>
              }
              @default {
                <div class="grid grid-cols-7 gap-0.5 text-center text-xs">
                  @for (w of weekdays; track w) {
                    <span class="py-1 font-medium text-muted">{{ w }}</span>
                  }
                  @for (_ of days().offset; track $index) {
                    <span></span>
                  }
                  @for (c of days().cells; track c.iso) {
                    <button
                      type="button"
                      class="cursor-pointer rounded-md py-1.5 text-sm tabular-nums"
                      [class]="
                        c.selected
                          ? 'bg-primary font-semibold text-primary-content'
                          : c.today
                            ? 'font-semibold text-primary ring-1 ring-primary ring-inset hover:bg-base-300'
                            : c.weekend
                              ? 'text-muted hover:bg-base-300'
                              : 'hover:bg-base-300'
                      "
                      [attr.aria-pressed]="c.selected"
                      [attr.aria-label]="
                        c.day + ' ' + monthNames[month().month - 1] + ' ' + month().year
                      "
                      (click)="pickDay(c.iso)"
                    >
                      {{ c.day }}
                    </button>
                  }
                </div>
              }
            }

            <div class="mt-2 flex justify-between border-t border-line pt-2 text-sm">
              <button
                type="button"
                class="cursor-pointer text-primary hover:underline"
                (click)="pickDay(todayIso())"
              >
                Сьогодні
              </button>
              <button
                type="button"
                class="cursor-pointer text-muted hover:underline"
                (click)="clear()"
              >
                Очистити
              </button>
            </div>
          </div>

          @if (withTime()) {
            <div class="flex w-24 flex-col border-l border-line py-3">
              <p class="px-3 pb-2 text-xs text-muted">Година</p>
              <div
                #timeList
                class="flex max-h-64 flex-col gap-0.5 overflow-y-auto px-2"
                role="listbox"
                aria-label="Година"
              >
                @for (t of slots; track t) {
                  <button
                    type="button"
                    role="option"
                    class="cursor-pointer rounded-md px-2 py-1.5 text-left text-sm tabular-nums"
                    [class]="
                      t === time()
                        ? 'bg-primary font-semibold text-primary-content'
                        : 'hover:bg-base-300'
                    "
                    [attr.aria-selected]="t === time()"
                    [attr.data-time]="t"
                    (click)="pickTime(t)"
                  >
                    {{ t }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class UiDateInputComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  /** The date and the hour: «РРРР-ММ-ДДTГГ:ХХ». */
  readonly withTime = input(false);
  /** The hour taken when only the day is picked (with `withTime`). */
  readonly defaultTime = input('09:00');
  readonly placeholder = input('');
  /** For <label for>. */
  readonly inputId = input('');
  /** Accessible name when there is no visible <label for>. */
  readonly ariaLabel = input('');
  readonly describedBy = input('');
  /** Which edge of the field the calendar keeps to (right — a field at the right edge of a card). */
  readonly align = input<'left' | 'right'>('left');
  readonly touch = output<void>();

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly textField = viewChild.required<ElementRef<HTMLInputElement>>('textField');
  private readonly timeList = viewChild<ElementRef<HTMLElement>>('timeList');

  protected readonly weekdays = UI_WEEKDAY_NAMES;
  protected readonly monthNames = UI_MONTH_NAMES;
  protected readonly slots = uiTimeSlots();
  protected readonly todayIso = uiTodayIso;
  protected readonly open = signal(false);
  protected readonly view = signal<View>('days');
  protected readonly text = linkedSignal(() => uiValueToDisplay(this.value()));

  private readonly parts = computed(() => uiSplitValue(this.value()));
  protected readonly time = computed(() => this.parts()?.time ?? '');

  /** The month shown: of the value, otherwise the current one. */
  protected readonly month = linkedSignal(() => {
    const date = this.parts()?.date;
    const base = date ? new Date(`${date}T00:00:00Z`) : new Date();
    return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
  });

  protected readonly title = computed(() => {
    const { year, month } = this.month();
    if (this.view() === 'years')
      return `${this.years()[0]} – ${this.years()[this.years().length - 1]}`;
    if (this.view() === 'months') return String(year);
    return `${this.monthNames[month - 1]} ${year}`;
  });

  /** Twelve years around the shown one. */
  protected readonly years = computed(() => {
    const start = this.month().year - (this.month().year % 12);
    return Array.from({ length: 12 }, (_, i) => start + i);
  });

  protected readonly days = computed(() => {
    const { year, month } = this.month();
    const first = new Date(Date.UTC(year, month - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday first
    const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today = uiTodayIso();
    const selected = this.parts()?.date;
    const cells: UiCalendarCell[] = [];
    for (let d = 1; d <= total; d++) {
      const iso = uiToIso(year, month, d);
      const weekday = (offset + d - 1) % 7;
      cells.push({
        day: d,
        iso,
        today: iso === today,
        selected: iso === selected,
        weekend: weekday >= 5,
      });
    }
    return { offset: Array.from({ length: offset }), cells };
  });

  focus(options?: FocusOptions) {
    this.textField().nativeElement.focus(options);
  }

  close() {
    this.open.set(false);
  }

  protected onInput(event: Event) {
    const field = event.target as HTMLInputElement;
    const masked = uiMaskDateInput(field.value, this.withTime());
    field.value = masked;
    this.text.set(masked);
    this.value.set(masked ? uiDisplayToValue(masked, this.withTime()) : '');
  }

  protected toggle() {
    if (this.disabled() || this.readonly()) return;
    this.view.set('days');
    this.open.update((v) => !v);
    if (this.open()) setTimeout(() => this.scrollToTime());
  }

  protected switchView() {
    this.view.update((v) => (v === 'days' ? 'months' : v === 'months' ? 'years' : 'days'));
  }

  protected shift(step: number) {
    const v = this.view();
    this.month.update(({ year, month }) => {
      if (v === 'years') return { year: year + step * 12, month };
      if (v === 'months') return { year: year + step, month };
      const index = year * 12 + (month - 1) + step;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  protected pickYear(year: number) {
    this.month.update((m) => ({ ...m, year }));
    this.view.set('months');
  }

  protected pickMonth(month: number) {
    this.month.update((m) => ({ ...m, month }));
    this.view.set('days');
  }

  protected pickDay(iso: string) {
    if (this.withTime()) {
      const had = this.time();
      this.value.set(`${iso}T${had || this.defaultTime()}`);
      // the day is picked — the hour is next, unless it was there already
      if (had) this.done();
      return;
    }
    this.value.set(iso);
    this.done();
  }

  protected pickTime(time: string) {
    this.value.set(`${this.parts()?.date ?? uiTodayIso()}T${time}`);
    this.done();
  }

  protected clear() {
    this.value.set('');
    this.close();
    this.touch.emit();
  }

  private done() {
    this.close();
    this.touch.emit();
    this.focus();
  }

  private scrollToTime() {
    const list = this.timeList()?.nativeElement;
    const target = list?.querySelector<HTMLElement>(
      `[data-time="${this.time() || this.defaultTime()}"]`,
    );
    if (list && target) list.scrollTop = target.offsetTop - list.clientHeight / 2;
  }

  protected onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.root().nativeElement.contains(event.target as Node)) this.close();
  }
}
