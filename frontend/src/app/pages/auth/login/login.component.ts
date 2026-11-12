import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { CopyrightComponent } from '../../../shared/components/copyright/copyright.component';
import { AccountService } from '../../../shared/services/account.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthService } from '../../../shared/services/auth.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormFieldComponent, IconComponent, RouterLink, CopyrightComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** ?returnUrl=… from the URL (withComponentInputBinding). */
  readonly returnUrl = input<string>('/');
  /** ?reason=idle — signed out after 10 minutes of inactivity. */
  readonly reason = input<string>('');
  /** ?signup=rejected — the KEP sign-up was not confirmed. */
  readonly signup = input<string>('');

  protected readonly error = signal('');
  /** The link «Зареєструвати компанію» — when the self sign-up is on. */
  protected readonly signupEnabled = signal(false);
  protected readonly model = signal(this.prefilledBeforeHydration());
  protected readonly loginForm = form(this.model, (p) => {
    required(p.email, { message: 'Вкажіть email' });
    email(p.email, { message: 'Вкажіть email у форматі name@company.ua' });
    required(p.password, { message: 'Вкажіть пароль' });
  });

  constructor() {
    void inject(AccountService)
      .registerInfo()
      .then((info) => this.signupEnabled.set(info.enabled))
      .catch(() => undefined);
  }

  /**
   * The login page comes from SSR: a password manager (or a fast user) may fill the fields
   * before hydration — the form binding would then wipe the input. Pick the values up from the DOM.
   */
  private prefilledBeforeHydration() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return { email: '', password: '' };
    const doc = inject(DOCUMENT);
    const value = (autocomplete: string) =>
      doc.querySelector<HTMLInputElement>(`app-login input[autocomplete="${autocomplete}"]`)
        ?.value ?? '';
    return { email: value('username'), password: value('current-password') };
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();
    this.error.set('');
    await submit(this.loginForm, async () => {
      try {
        const { email: e, password } = this.model();
        await this.auth.login(e, password);
        await this.router.navigateByUrl(this.returnUrl() || '/');
      } catch (err) {
        this.error.set(apiErrorMessage(err, 'Не вдалося увійти'));
      }
      return undefined;
    });
  }
}
