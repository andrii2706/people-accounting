import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { UiBusyDirective } from '@mr/ui';
import { DateInputComponent } from '../../../../shared/components/date-input/date-input.component';
import { FormFieldComponent } from '../../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PhoneInputComponent } from '../../../../shared/components/phone-input/phone-input.component';
import type { ContactsChangeForm } from '../../../../shared/interfaces/employee-dialogs.interface';
import type {
  EmployeeDetails,
  EmployeePayload,
} from '../../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../../shared/services/employees.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { formSubmitErrors } from '../../../../shared/utils/api-error.utils';
import { todayIso } from '../../../../shared/utils/date.utils';
import { MAX_LENGTH, MESSAGE, PATTERN } from '../../../../shared/validators/employee-rules';

/**
 * «Змінити контакти й адреси»: the new phone, e-mail and addresses with the day they changed. The old values stay
 * in the history of the card; a new address queues the notice to the TCK, the phone and the e-mail do not.
 */
@Component({
  selector: 'app-contacts-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    FormField,
    FormFieldComponent,
    DateInputComponent,
    PhoneInputComponent,
    IconComponent,
    UiBusyDirective,
  ],
  templateUrl: './contacts-dialog.component.html',
})
export class ContactsDialogComponent {
  private readonly employees = inject(EmployeesService);
  private readonly toast = inject(ToastService);

  readonly employee = input.required<EmployeeDetails>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly model = signal<ContactsChangeForm>(this.fromEmployee(null));
  protected readonly form = form(this.model, (p) => {
    maxLength(p.phone, MAX_LENGTH.phone, { message: MESSAGE.tooLong(MAX_LENGTH.phone) });
    pattern(p.phone, PATTERN.phoneE164, { message: MESSAGE.phoneE164 });
    maxLength(p.email, MAX_LENGTH.email, { message: MESSAGE.tooLong(MAX_LENGTH.email) });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    maxLength(p.registeredAddress, MAX_LENGTH.registeredAddress, {
      message: MESSAGE.tooLong(MAX_LENGTH.registeredAddress),
    });
    maxLength(p.actualAddress, MAX_LENGTH.actualAddress, {
      message: MESSAGE.tooLong(MAX_LENGTH.actualAddress),
    });
    required(p.effectiveDate, { message: 'Вкажіть, коли це змінилось' });
    validate(p.effectiveDate, ({ value }) =>
      value() && value() > todayIso() ? { kind: 'future', message: MESSAGE.futureDate } : undefined,
    );
    maxLength(p.basis, MAX_LENGTH.changeBasis, {
      message: MESSAGE.tooLong(MAX_LENGTH.changeBasis),
    });
  });
  protected readonly saving = signal(false);

  /** What will change compared with the card. */
  protected readonly changes = computed(() => {
    const e = this.employee();
    const m = this.model();
    const actual = m.sameAsRegistered ? '' : m.actualAddress.trim();
    return {
      phone: m.phone.trim() !== (e.phone ?? ''),
      email: m.email.trim() !== (e.email ?? ''),
      registeredAddress: m.registeredAddress.trim() !== (e.registeredAddress ?? ''),
      actualAddress: actual !== (e.actualAddress ?? ''),
    };
  });
  protected readonly addressChanged = computed(
    () => this.changes().registeredAddress || this.changes().actualAddress,
  );
  protected readonly anyChange = computed(() => Object.values(this.changes()).some(Boolean));

  constructor() {
    // every opening starts from the card as it is now
    effect(() => {
      if (!this.open()) return;
      const e = this.employee();
      untracked(() => {
        this.model.set(this.fromEmployee(e));
        this.form().reset();
      });
    });
  }

  protected was(value: string | null | undefined): string {
    return value ? `Зараз: ${value}` : 'Зараз: не вказано';
  }

  protected async save(event: Event) {
    event.preventDefault();
    if (!this.anyChange()) {
      this.toast.info('Нічого не змінено');
      return;
    }
    await submit(this.form, async () => {
      const m = this.model();
      const c = this.changes();
      const payload: EmployeePayload = {
        changeMeta: { effectiveDate: m.effectiveDate, basis: m.basis.trim() || undefined },
      };
      if (c.phone) payload.phone = m.phone.trim();
      if (c.email) payload.email = m.email.trim();
      if (c.registeredAddress) payload.registeredAddress = m.registeredAddress.trim();
      if (c.actualAddress) payload.actualAddress = m.sameAsRegistered ? '' : m.actualAddress.trim();
      this.saving.set(true);
      try {
        await this.employees.update(this.employee().id, payload);
        this.toast.success(
          this.addressChanged()
            ? 'Збережено · повідомлення ТЦК додано до об’єднаного листа'
            : 'Контакти збережено',
        );
        this.saved.emit();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.form, (message) => this.toast.error(message));
      } finally {
        this.saving.set(false);
      }
    });
  }

  private fromEmployee(e: EmployeeDetails | null): ContactsChangeForm {
    return {
      phone: e?.phone ?? '',
      email: e?.email ?? '',
      registeredAddress: e?.registeredAddress ?? '',
      actualAddress: e?.actualAddress ?? '',
      sameAsRegistered: !!e && !e.actualAddress,
      effectiveDate: todayIso(),
      basis: '',
    };
  }
}
