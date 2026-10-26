import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Структурний тип поля Signal Forms, щоб не залежати від типу значення. */
export type FieldLike = () => {
  touched: () => boolean;
  errors: () => readonly { message?: string }[];
};

/**
 * Обгортка поля Signal Forms: підпис, підказка та помилки валідації.
 * Сам контрол передається через ng-content з директивою [formField].
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
  /** Попередження, яке не блокує збереження (напр. розбіжність РНОКПП і дати народження). */
  readonly warning = input('');
  readonly required = input(false);
  /** Будь-яке поле FieldTree — потрібні лише touched() та errors(). */
  readonly field = input<FieldLike | null>(null);

  protected readonly errors = computed(() => {
    const f = this.field();
    if (!f) return [];
    const state = f();
    if (!state.touched()) return [];
    return state.errors().map((e) => e.message ?? 'Некоректне значення');
  });
}
