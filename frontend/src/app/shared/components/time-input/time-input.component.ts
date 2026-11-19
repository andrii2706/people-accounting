import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { maskTimeInput } from '../../utils/date.utils';

/**
 * Time ГГ:ХХ typed as digits only — the colon is put in by itself: «1430» → «14:30», «930» → «09:30».
 * Pasted «14.30» or «14 30» become «14:30» too.
 */
@Component({
  selector: 'app-time-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <input
      #field
      class="input font-mono tabular-nums"
      inputmode="numeric"
      autocomplete="off"
      maxlength="5"
      [placeholder]="placeholder()"
      [value]="value()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-label]="ariaLabel() ?? null"
      (input)="onInput($event)"
      (blur)="touch.emit()"
    />
  `,
})
export class TimeInputComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();
  readonly placeholder = input('ГГХХ');
  readonly ariaLabel = input<string | undefined>(undefined);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  focus(options?: FocusOptions) {
    this.field().nativeElement.focus(options);
  }

  protected onInput(event: Event) {
    const el = event.target as HTMLInputElement;
    const masked = maskTimeInput(el.value);
    el.value = masked;
    this.value.set(masked);
  }
}
