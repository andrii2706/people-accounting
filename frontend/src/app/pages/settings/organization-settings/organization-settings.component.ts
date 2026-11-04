import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
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
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type {
  NotificationStatus,
  OrganizationExtraForm,
  OrganizationSettingsData,
  OrganizationTermsForm,
} from '../../../shared/interfaces/organization.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { MESSAGE } from '../../../shared/validators/employee-rules';
import { wholeDays } from '../../../shared/validators/organization.validators';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';

@Component({
  selector: 'app-organization-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DateInputComponent,
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    UaDatePipe,
    RouterLink,
  ],
  templateUrl: './organization-settings.component.html',
})
export class OrganizationSettingsComponent {
  private readonly organizationService = inject(OrganizationService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  private readonly refresh = injectRouteRefresh();
  /** API errors that have no field on the form go to a toast. */
  private readonly notifyError = (message: string) => this.toast.error(message);

  /** System settings and the e-mail / mobilization status — organizationSettingsResolver. */
  readonly settings = input.required<OrganizationSettingsData>();
  /** Status of e-mail and the mobilization term; refreshed after «Перевірити укази». */
  protected readonly status = linkedSignal<NotificationStatus>(() => this.settings().status);

  protected readonly termsModel = linkedSignal<OrganizationTermsForm>(() => {
    const o = this.settings().organization;
    return { alertDays: o.alertDays, notifyDeadlineDays: o.notifyDeadlineDays };
  });
  protected readonly termsForm = form(this.termsModel, (p) => {
    required(p.alertDays, { message: 'Вкажіть кількість днів' });
    required(p.notifyDeadlineDays, { message: 'Вкажіть кількість днів' });
    min(p.alertDays, 1, { message: 'Щонайменше 1 день' });
    max(p.alertDays, 365, { message: 'Не більше 365 днів' });
    min(p.notifyDeadlineDays, 1, { message: 'Щонайменше 1 день' });
    max(p.notifyDeadlineDays, 60, { message: 'Не більше 60 днів' });
    validate(p.alertDays, ({ value }) => wholeDays(value()));
    validate(p.notifyDeadlineDays, ({ value }) => wholeDays(value()));
  });

  protected async saveTerms(event: Event) {
    event.preventDefault();
    await submit(this.termsForm, async () => {
      try {
        const m = this.termsModel();
        await this.organizationService.update({
          alertDays: Number(m.alertDays),
          notifyDeadlineDays: Number(m.notifyDeadlineDays),
        });
        this.toast.success('Строки збережено');
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.termsForm, this.notifyError);
      }
    });
  }

  protected readonly extraModel = linkedSignal<OrganizationExtraForm>(() => {
    const o = this.settings().organization;
    return {
      mobilizationUntil: o.mobilizationUntil ?? '',
      mobilizationDecree: o.mobilizationDecree ?? '',
    };
  });
  protected readonly extraForm = form(this.extraModel, (p) => {
    maxLength(p.mobilizationDecree, 300, { message: MESSAGE.tooLong(300) });
  });
  protected readonly savingExtra = signal(false);

  protected async saveMobilization() {
    const f = this.extraForm;
    f.mobilizationUntil().markAsTouched();
    f.mobilizationDecree().markAsTouched();
    if (f().invalid()) return;
    const m = this.extraModel();
    this.savingExtra.set(true);
    try {
      await this.organizationService.update({
        mobilizationUntil: m.mobilizationUntil || null,
        mobilizationDecree: m.mobilizationDecree.trim(),
      });
      this.toast.success('Строк мобілізації збережено');
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.savingExtra.set(false);
    }
  }

  protected readonly checkingDecrees = signal(false);
  protected async checkDecrees() {
    this.checkingDecrees.set(true);
    try {
      const r = await this.organizationService.checkDecrees();
      if (r.ok) {
        this.toast.success(
          r.changed ? 'Знайдено новий указ — строк мобілізації оновлено' : 'Строк не змінився',
        );
        await this.refresh();
      } else {
        this.toast.error(r.message ?? 'Не вдалося перевірити укази');
      }
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.checkingDecrees.set(false);
    }
  }
}
