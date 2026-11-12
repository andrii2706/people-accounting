import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { BillingNoticeComponent } from '../../../shared/components/billing-notice/billing-notice.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import type { BillingForm, BillingRecord } from '../../../shared/interfaces/billing.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { BillingService } from '../../../shared/services/billing.service';
import { ToastService } from '../../../shared/services/toast.service';
import { formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { billingToForm, formToBilling, parseAmount } from '../../../shared/utils/billing.utils';
import { validateAmount } from '../../../shared/validators/billing.validators';

/**
 * Vendor page: debt of the client for using the system. While there is a debt every user may sign in once,
 * after that the sign-in is blocked until the debt is cleared here (or with `npm run billing -- --clear`).
 */
@Component({
  selector: 'app-billing-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FormFieldComponent,
    DateInputComponent,
    BillingNoticeComponent,
    UaDateTimePipe,
  ],
  templateUrl: './billing-settings.component.html',
})
export class BillingSettingsComponent {
  private readonly billing = inject(BillingService);
  private readonly toast = inject(ToastService);

  /** From billingRecordResolver. */
  readonly record = input.required<BillingRecord>();
  protected readonly current = linkedSignal(() => this.record());

  protected readonly model = linkedSignal<BillingForm>(() => billingToForm(this.current()));
  protected readonly f = form(this.model, (p) => {
    validate(p.amount, ({ value }) => validateAmount(value()));
    maxLength(p.paymentContact, 300, { message: 'Не більше 300 символів' });
  });

  /** What users will see after the next sign-in. */
  protected readonly preview = computed(() => {
    const m = this.model();
    const amount = parseAmount(m.amount);
    return {
      hasDebt: m.hasDebt,
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      debtSince: m.debtSince || null,
      paymentContact: m.paymentContact.trim(),
    };
  });

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.f, async () => {
      try {
        this.current.set(await this.billing.update(formToBilling(this.model())));
        this.toast.success(
          this.model().hasDebt
            ? 'Заборгованість встановлено'
            : 'Заборгованість знято — вхід відкрито',
        );
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.f, (m) => this.toast.error(m));
      }
    });
  }
}
