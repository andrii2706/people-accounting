import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AuthService } from '../../shared/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { apiErrorMessage } from '../../shared/utils/api-error.utils';
import { passwordProblems } from '../../shared/validators/password.validators';

/** Профіль: зміна власного пароля (обов’язкова, якщо пароль тимчасовий). */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, FormField, FormFieldComponent],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly error = signal('');
  protected readonly model = signal({ currentPassword: '', newPassword: '', confirmPassword: '' });
  protected readonly passwordForm = form(this.model, (p) => {
    required(p.currentPassword, { message: 'Вкажіть поточний пароль' });
    required(p.newPassword, { message: 'Вкажіть новий пароль' });
    validate(p.newPassword, ({ value }) => {
      const problems = passwordProblems(value(), this.auth.user()?.email);
      return problems.length
        ? { kind: 'policy', message: `Пароль: ${problems.join(', ')}` }
        : undefined;
    });
    validate(p.newPassword, ({ value, valueOf }) =>
      value() && value() === valueOf(p.currentPassword)
        ? { kind: 'same', message: 'Новий пароль має відрізнятися від поточного' }
        : undefined,
    );
    validate(p.confirmPassword, ({ value, valueOf }) =>
      value() !== valueOf(p.newPassword)
        ? { kind: 'mismatch', message: 'Паролі не збігаються' }
        : undefined,
    );
    maxLength(p.newPassword, 200, { message: 'Не більше 200 символів' });
  });

  protected async save(event: Event) {
    event.preventDefault();
    this.error.set('');
    await submit(this.passwordForm, async () => {
      try {
        const forced = this.auth.mustChangePassword();
        const { currentPassword, newPassword } = this.model();
        await this.auth.changePassword(currentPassword, newPassword);
        this.model.set({ currentPassword: '', newPassword: '', confirmPassword: '' });
        this.passwordForm().reset();
        this.toast.success('Пароль змінено. Інші сесії завершено.');
        if (forced) await this.router.navigateByUrl('/');
      } catch (err) {
        this.error.set(apiErrorMessage(err));
      }
      return undefined;
    });
  }
}
