import {
  ENTITY_ISSUED_ROLES,
  ROLE_LABELS,
  ROLE_OPTIONS,
} from '../../../shared/constants/auth.constants';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type {
  IssuedPassword,
  ManagedUser,
  UserRole,
} from '../../../shared/interfaces/auth.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UsersService } from '../../../shared/services/users.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { passwordProblems } from '../../../shared/validators/password.validators';
import { SelectComponent } from '../../../shared/components/select/select.component';
import type { SelectOption } from '../../../shared/interfaces/ui.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { canManageUser, roleNeedsEntity } from '../../../shared/utils/user-policy.utils';
import { legalEntityName } from '../../../shared/utils/legal-entity.utils';

/**
 * Accounts: the main administrator — all of them (role, legal entity); the administrator / director of a
 * legal entity — the HR and director accounts of his legal entity.
 */
@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SelectComponent,
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
  private readonly dict = inject(DictionariesService);

  readonly users = input.required<ManagedUser[]>();

  /** Temporary password after a reset — shown once. */
  protected readonly issuedPassword = signal<IssuedPassword | null>(null);
  protected readonly now = signal(Date.now());
  protected readonly lockedIds = computed(() => {
    const now = this.now();
    return new Set(
      this.users()
        .filter((u) => u.lockedUntil && Date.parse(u.lockedUntil) > now)
        .map((u) => u.id),
    );
  });

  /** Legal entities to choose from (the main administrator). */
  protected readonly entityOptions = computed<SelectOption<string>[]>(() =>
    this.dict.legalEntities().map((e) => ({ value: e.id, label: legalEntityName(e) })),
  );
  protected readonly entityNames = computed(
    () => new Map(this.dict.legalEntities().map((e) => [e.id, legalEntityName(e)])),
  );

  /** Roles the signed-in user may give. */
  protected readonly roleOptions = computed(() =>
    this.auth.isAdmin()
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter((o) => ENTITY_ISSUED_ROLES.includes(o.value)),
  );

  protected roleLabel(role: UserRole) {
    return ROLE_LABELS[role];
  }

  protected canManage(u: ManagedUser) {
    return canManageUser(this.auth.user(), u);
  }

  private readonly blank = {
    fullName: '',
    email: '',
    password: '',
    role: 'HR' as UserRole,
    legalEntityId: '',
  };
  protected readonly userModel = signal({ ...this.blank });
  protected readonly userForm = form(this.userModel, (p) => {
    required(p.fullName, { message: 'Вкажіть ім’я' });
    required(p.email, { message: 'Вкажіть email' });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    required(p.password, { message: 'Вкажіть тимчасовий пароль' });
    validate(p.password, ({ value, valueOf }) => {
      const problems = passwordProblems(value(), valueOf(p.email));
      return problems.length
        ? { kind: 'policy', message: `Потрібно: ${problems.join(', ')}` }
        : undefined;
    });
    maxLength(p.fullName, 200, { message: 'Не більше 200 символів' });
    maxLength(p.email, 200, { message: 'Не більше 200 символів' });
    maxLength(p.password, 200, { message: 'Не більше 200 символів' });
    // the main administrator chooses the legal entity; the others create accounts of their own one
    validate(p.legalEntityId, ({ value, valueOf }) =>
      this.auth.isAdmin() && roleNeedsEntity(valueOf(p.role)) && !value()
        ? { kind: 'required', message: 'Оберіть юридичну особу' }
        : undefined,
    );
  });

  protected async create(event: Event) {
    event.preventDefault();
    await submit(this.userForm, async () => {
      try {
        const { legalEntityId, ...rest } = this.userModel();
        await this.usersService.create({
          ...rest,
          legalEntityId: rest.role === 'ADMIN' ? null : legalEntityId || null,
        });
        this.userModel.set({ ...this.blank });
        this.userForm().reset();
        this.toast.success(
          'Користувача створено. Лист з паролем надіслано на його email (якщо пошту налаштовано); при першому вході він змінить пароль.',
        );
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.userForm, (m) => this.toast.error(m));
      }
    });
  }

  protected toggle(u: ManagedUser) {
    return this.run(
      () => this.usersService.update(u.id, { isActive: !u.isActive }),
      u.isActive ? 'Заблоковано, сесії завершено' : 'Розблоковано',
    );
  }

  protected setEntity(u: ManagedUser, legalEntityId: string) {
    return this.run(
      () => this.usersService.update(u.id, { legalEntityId: legalEntityId || null }),
      'Юридичну особу змінено',
    );
  }

  protected setRole(u: ManagedUser, role: UserRole) {
    return this.run(() => this.usersService.update(u.id, { role }), 'Роль змінено');
  }

  protected setNotify(u: ManagedUser, notify: boolean) {
    return this.run(
      () => this.usersService.update(u.id, { notify }),
      notify ? 'Сповіщення увімкнено' : 'Сповіщення вимкнено',
    );
  }

  protected unlock(u: ManagedUser) {
    return this.run(() => this.usersService.unlock(u.id), 'Вхід розблоковано');
  }

  /** Letter 2: «change your password» with a link; until changed the user gets only the password page. */
  protected async requestPasswordChange(u: ManagedUser) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Надіслати «${u.fullName}» лист на зміну пароля? До зміни пароля він зможе відкрити лише сторінку пароля.`,
      )
    )
      return;
    try {
      const { mailSent, email } = await this.usersService.requestPasswordChange(u.id);
      if (mailSent) this.toast.success(`Лист на зміну пароля надіслано на ${email}`);
      else
        this.toast.error(
          'Пошту для доступів не налаштовано — лист не надіслано. Користувач змінить пароль після входу.',
        );
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  protected async resetPassword(u: ManagedUser) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Скинути пароль для «${u.fullName}»? Усі його сесії буде завершено.`)
    )
      return;
    try {
      const { temporaryPassword, mailSent, expiresAt } = await this.usersService.resetPassword(
        u.id,
      );
      this.issuedPassword.set({
        user: u.fullName,
        password: temporaryPassword,
        mailedTo: mailSent ? u.email : '',
        expiresAt,
      });
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
