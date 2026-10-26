import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { ManagedUser, UserRole } from '../../../shared/interfaces/auth.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UsersService } from '../../../shared/services/users.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { passwordProblems } from '../../../shared/validators/password.validators';

/** Адміністрування облікових записів: ролі, блокування, скидання пароля. */
@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    FormField,
    FormFieldComponent,
    IconComponent,
    RouterLink,
    UaDateTimePipe,
  ],
  templateUrl: './users.component.html',
})
export class UsersComponent {
  private readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();
  protected readonly auth = inject(AuthService);

  /** Дані з usersResolver. */
  readonly users = input.required<ManagedUser[]>();

  /** Тимчасовий пароль після скидання — показується один раз. */
  protected readonly issuedPassword = signal<{ user: string; password: string } | null>(null);
  protected readonly now = signal(Date.now());
  protected readonly lockedIds = computed(() => {
    const now = this.now();
    return new Set(
      this.users()
        .filter((u) => u.lockedUntil && Date.parse(u.lockedUntil) > now)
        .map((u) => u.id),
    );
  });

  private readonly blank = { fullName: '', email: '', password: '', role: 'HR' as UserRole };
  protected readonly userModel = signal({ ...this.blank });
  protected readonly userForm = form(this.userModel, (p) => {
    required(p.fullName, { message: 'Вкажіть ім’я' });
    required(p.email, { message: 'Вкажіть email' });
    validate(p.email, ({ value }) =>
      value() && !/^\S+@\S+\.\S+$/.test(value())
        ? { kind: 'email', message: 'Некоректний email' }
        : undefined,
    );
    required(p.password, { message: 'Вкажіть тимчасовий пароль' });
    validate(p.password, ({ value, valueOf }) => {
      const problems = passwordProblems(value(), valueOf(p.email));
      return problems.length
        ? { kind: 'policy', message: `Пароль: ${problems.join(', ')}` }
        : undefined;
    });
    maxLength(p.fullName, 200, { message: 'Не більше 200 символів' });
    maxLength(p.email, 200, { message: 'Не більше 200 символів' });
    maxLength(p.password, 200, { message: 'Не більше 200 символів' });
  });

  protected async create(event: Event) {
    event.preventDefault();
    await submit(this.userForm, async () => {
      try {
        await this.usersService.create(this.userModel());
        this.userModel.set({ ...this.blank });
        this.userForm().reset();
        this.toast.success('Користувача створено. При першому вході він змінить пароль.');
        await this.refresh();
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
      return undefined;
    });
  }

  protected toggle(u: ManagedUser) {
    return this.run(
      () => this.usersService.update(u.id, { isActive: !u.isActive }),
      u.isActive ? 'Заблоковано, сесії завершено' : 'Розблоковано',
    );
  }

  protected setRole(u: ManagedUser, role: UserRole) {
    return this.run(() => this.usersService.update(u.id, { role }), 'Роль змінено');
  }

  protected unlock(u: ManagedUser) {
    return this.run(() => this.usersService.unlock(u.id), 'Вхід розблоковано');
  }

  protected async resetPassword(u: ManagedUser) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Скинути пароль для «${u.fullName}»? Усі його сесії буде завершено.`)
    )
      return;
    try {
      const { temporaryPassword } = await this.usersService.resetPassword(u.id);
      this.issuedPassword.set({ user: u.fullName, password: temporaryPassword });
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  protected async copyPassword() {
    const issued = this.issuedPassword();
    if (!issued || typeof navigator === 'undefined') return;
    await navigator.clipboard.writeText(issued.password);
    this.toast.success('Скопійовано');
  }

  private async run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      this.toast.success(success);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }
}
