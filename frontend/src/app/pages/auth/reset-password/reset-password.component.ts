import { CopyrightComponent } from '../../../shared/components/copyright/copyright.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { NewPasswordForm } from '../../../shared/interfaces/auth.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { orEmpty } from '../../../shared/utils/router.utils';
import { passwordProblems } from '../../../shared/validators/password.validators';

/**
 * «Set a new password» by the link from a letter (the password expires soon, or the administrator asked
 * to change it). Works without signing in; after the change every session ends and the user signs in anew.
 */
@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FormFieldComponent,
    IconComponent,
    RouterLink,
    UaDateTimePipe,
    CopyrightComponent,
  ],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);

  /** ?token= from the letter */
  readonly token = input<string, string | undefined>('', { transform: orEmpty });

  protected readonly link = resource({
    params: () => this.token() || undefined,
    loader: ({ params }) => this.auth.passwordLink(params),
  });
  protected readonly linkError = computed(() =>
    !this.token()
      ? 'У посиланні немає коду — відкрийте його з листа ще раз.'
      : this.link.error()
        ? apiErrorMessage(this.link.error())
        : '',
  );
  protected readonly done = signal('');

  protected readonly model = signal<NewPasswordForm>({ newPassword: '', confirmPassword: '' });
  protected readonly passwordForm = form(this.model, (p) => {
    required(p.newPassword, { message: 'Вкажіть новий пароль' });
    validate(p.newPassword, ({ value }) => {
      const problems = passwordProblems(value(), this.link.value()?.email);
      return problems.length
        ? { kind: 'policy', message: `Потрібно: ${problems.join(', ')}` }
        : undefined;
    });
    validate(p.confirmPassword, ({ value, valueOf }) =>
      value() !== valueOf(p.newPassword)
        ? { kind: 'mismatch', message: 'Паролі не збігаються' }
        : undefined,
    );
    maxLength(p.newPassword, 200, { message: 'Не більше 200 символів' });
  });
  protected readonly formError = signal('');

  protected async save(event: Event) {
    event.preventDefault();
    this.formError.set('');
    await submit(this.passwordForm, async () => {
      try {
        const { email } = await this.auth.resetPassword(this.token(), this.model().newPassword);
        this.done.set(email);
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.passwordForm, (message) => this.formError.set(message));
      }
    });
  }
}
