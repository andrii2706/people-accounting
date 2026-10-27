import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Structural type of a Signal Forms field, so it does not depend on the value type. */
export type FieldLike = () => {
  touched: () => boolean;
  errors: () => readonly { message?: string }[];
};

/**
 * Signal Forms field wrapper: label, hint and validation errors.
 * The control itself is projected via ng-content with the [formField] directive.
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './form-field.component.html',
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly hint = input('');
  /** Warning that does not block saving (e.g. RNOKPP does not match the date of birth). */
  readonly warning = input('');
  readonly required = input(false);
  /** Any FieldTree field — only touched() and errors() are needed. */
  readonly field = input<FieldLike | null>(null);

  protected readonly errors = computed(() => {
    const f = this.field();
    if (!f) return [];
    const state = f();
    if (!state.touched()) return [];
    return state.errors().map((e) => e.message ?? 'Некоректне значення');
  });
}
