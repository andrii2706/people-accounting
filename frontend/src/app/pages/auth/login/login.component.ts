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
import { Router } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthService } from '../../../shared/services/auth.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormFieldComponent, IconComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** ?returnUrl=… з адреси (withComponentInputBinding). */
  readonly returnUrl = input<string>('/');

  protected readonly error = signal('');
  protected readonly model = signal(this.prefilledBeforeHydration());
  protected readonly loginForm = form(this.model, (p) => {
    required(p.email, { message: 'Вкажіть email' });
    email(p.email, { message: 'Некоректний email' });
    required(p.password, { message: 'Вкажіть пароль' });
  });

  /**
   * Сторінка входу приходить з SSR: менеджер паролів (або швидкий користувач) може заповнити поля
   * ще до гідратації — тоді прив'язка форми затерла б введене. Підхоплюємо значення з DOM.
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
