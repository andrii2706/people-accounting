import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
  output,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { DEFAULT_PHONE_CODE, PHONE_COUNTRIES } from '../../constants/phone.constants';
import type { SelectOption } from '../../interfaces/ui.interface';
import { joinPhone, splitPhone } from '../../utils/phone.utils';
import { SelectComponent } from '../select/select.component';

/**
 * Phone with the country chosen separately: the user types only the digits after the code,
 * the value is stored as «+<code><digits>» (e.g. +380671234567) — no spaces, brackets or dashes.
 */
@Component({
  selector: 'app-phone-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectComponent],
  host: { class: 'block' },
  templateUrl: './phone-input.component.html',
})
export class PhoneInputComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();
  readonly ariaLabel = input<string | undefined>(undefined);

  protected readonly options: SelectOption[] = PHONE_COUNTRIES.map((c) => ({
    value: c.code,
    label: `${c.iso} +${c.code}`,
    hint: c.name,
  }));

  /** The chosen country survives an empty number (the value is '' then). */
  protected readonly code = linkedSignal<string, string>({
    source: this.value,
    computation: (v, previous) =>
      v ? splitPhone(v).code : (previous?.value ?? DEFAULT_PHONE_CODE),
  });
  protected readonly national = computed(() => splitPhone(this.value()).national);
  protected readonly placeholder = computed(
    () => PHONE_COUNTRIES.find((c) => c.code === this.code())?.example ?? 'цифри номера',
  );

  protected setCode(code: string) {
    const next = code || DEFAULT_PHONE_CODE;
    this.code.set(next);
    if (this.national()) this.value.set(joinPhone(next, this.national()));
  }

  protected onInput(event: Event) {
    const field = event.target as HTMLInputElement;
    const next = joinPhone(this.code(), field.value);
    this.value.set(next);
    // keep only digits in the box: what is typed is exactly what is stored after the code
    field.value = splitPhone(next).national;
  }
}
