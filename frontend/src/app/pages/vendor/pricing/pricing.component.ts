import { ChangeDetectionStrategy, Component, inject, input, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  max,
  maxLength,
  min,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PhoneInputComponent } from '../../../shared/components/phone-input/phone-input.component';
import type {
  BillingSettingsView,
  PricingForm,
} from '../../../shared/interfaces/subscription.interface';
import { ToastService } from '../../../shared/services/toast.service';
import { VendorBillingService } from '../../../shared/services/vendor-billing.service';
import { formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { parsePrice, pricingToForm } from '../../../shared/utils/pricing.utils';

/** The vendor: the requisites of ТОВ «ПАВ ІТ» on the invoices and the agreement, the prices, the terms. */
@Component({
  selector: 'app-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormFieldComponent, PhoneInputComponent],
  templateUrl: './pricing.component.html',
})
export class PricingComponent {
  private readonly service = inject(VendorBillingService);
  private readonly toast = inject(ToastService);

  /** billingSettingsResolver */
  readonly settings = input.required<BillingSettingsView>();
  protected readonly current = linkedSignal(() => this.settings());

  protected readonly model = linkedSignal<PricingForm>(() => pricingToForm(this.current()));
  protected readonly f = form(this.model, (p) => {
    required(p.seller.name, { message: 'Назва постачальника' });
    maxLength(p.seller.name, 300, { message: 'Не більше 300 символів' });
    validate(p.seller.code, ({ value }) =>
      value() && !/^\d{8}$|^\d{10}$/.test(value())
        ? { kind: 'code', message: 'Код ЄДРПОУ — 8 цифр (РНОКПП ФОП — 10)' }
        : undefined,
    );
    validate(p.seller.ipn, ({ value }) =>
      value() && !/^\d{10,12}$/.test(value())
        ? { kind: 'ipn', message: 'ІПН — 10 або 12 цифр' }
        : undefined,
    );
    validate(p.seller.iban, ({ value }) =>
      value() && !/^UA\d{27}$/.test(value().replace(/\s/g, '').toUpperCase())
        ? { kind: 'iban', message: 'IBAN — UA і 27 цифр' }
        : undefined,
    );
    for (const price of [p.monthlyPrice, p.yearlyPrice]) {
      validate(price, ({ value }) => {
        const n = parsePrice(value());
        return Number.isNaN(n) || (n !== null && n < 1)
          ? { kind: 'price', message: 'Ціна — число від 1 грн, до 2 знаків після коми' }
          : undefined;
      });
    }
    validate(p.invoicePrefix, ({ value }) =>
      /^[A-Za-zА-ЯІЇЄҐа-яіїєґ0-9]{0,10}$/.test(value())
        ? undefined
        : { kind: 'prefix', message: 'До 10 літер або цифр' },
    );
    min(p.dueDays, 1, { message: 'Щонайменше 1 день' });
    max(p.dueDays, 60, { message: 'Не більше 60 днів' });
    min(p.trialDays, 0, { message: 'Не менше 0' });
    max(p.trialDays, 90, { message: 'Не більше 90 днів' });
  });

  protected async save(event: Event) {
    event.preventDefault();
    await submit(this.f, async () => {
      const m = this.model();
      try {
        this.current.set(
          await this.service.saveSettings({
            ...m,
            seller: { ...m.seller, iban: m.seller.iban.replace(/\s/g, '').toUpperCase() },
            monthlyPrice: parsePrice(m.monthlyPrice),
            yearlyPrice: parsePrice(m.yearlyPrice),
            dueDays: Number(m.dueDays),
            trialDays: Number(m.trialDays),
          }),
        );
        this.toast.success('Збережено');
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.f, (msg) => this.toast.error(msg));
      }
    });
  }
}
