import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

/**
 * The field for the code from the app: big digits, the phone's keyboard of digits, the browser may offer
 * the code it received (one-time-code). A recovery code «XXXX-XXXX» fits too.
 */
@Component({
  selector: 'app-code-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <input
      #field
      class="input text-center font-mono text-2xl tracking-[0.35em] tabular-nums"
      [attr.id]="inputId()"
      type="text"
      [attr.inputmode]="recovery() ? 'text' : 'numeric'"
      autocomplete="one-time-code"
      autocapitalize="characters"
      spellcheck="false"
      [attr.maxlength]="recovery() ? 9 : 7"
      [attr.aria-invalid]="invalid()"
      [attr.aria-describedby]="describedBy() || null"
      [placeholder]="recovery() ? 'XXXX-XXXX' : '000000'"
      [value]="value()"
      (input)="value.set($any($event.target).value)"
      (keydown.enter)="enter.emit()"
    />
  `,
})
export class CodeInputComponent {
  readonly value = model('');
  /** A recovery code is expected (letters allowed). */
  readonly recovery = input(false);
  readonly invalid = input(false);
  readonly inputId = input('code');
  readonly describedBy = input('');
  readonly autofocus = input(true);
  readonly enter = output<void>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) this.field().nativeElement.focus();
    });
  }
}
