import { ConfirmService } from '../../../shared/services/confirm.service';
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
  ModulesEditModel,
  UserEditModel,
  UserRole,
} from '../../../shared/interfaces/auth.interface';
import { APPS } from '../../../../platform/contracts/apps';
import { modulesLabel, toggleModule } from '../../../shared/utils/modules.utils';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { KYIV_DATETIME } from '../../../shared/utils/date.utils';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UsersService } from '../../../shared/services/users.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { temporaryPasswordProblems } from '../../../shared/validators/password.validators';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { ActionsMenuComponent } from '../../../shared/components/actions-menu/actions-menu.component';
import type { MenuAction, SelectOption } from '../../../shared/interfaces/ui.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import {
  canManageUser,
  roleNeedsEntity,
  temporaryPasswordExpired,
} from '../../../shared/utils/user-policy.utils';
import { legalEntityName } from '../../../shared/utils/legal-entity.utils';

/**
 * Accounts: the main administrator — all of them (role, legal entity); the administrator / director of a
 * legal entity — the HR and director accounts of his legal entity.
 */
@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionsMenuComponent,
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
  private readonly dialogs = inject(ConfirmService);
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

  /** The applications of the domain: «Військовий облік» works now, the others are marked «незабаром». */
  protected readonly apps = APPS;
  protected modulesLabel(u: ManagedUser) {
    return modulesLabel(u.role, u.modules);
  }
  /** The modules of a new account (the main administrator opens all of them anyway). */
  protected readonly newModules = signal<string[]>(['oblik']);
  protected toggleNewModule(id: string) {
    this.newModules.update((list) => toggleModule(list, id));
  }

  /** «Модулі» of one account, right in the table. */
  protected readonly modulesEdit = signal<ModulesEditModel>({ id: '', modules: [] });
  protected startModules(u: ManagedUser) {
    this.modulesEdit.set({ id: u.id, modules: u.modules?.length ? [...u.modules] : ['oblik'] });
  }
  protected toggleEditModule(id: string) {
    this.modulesEdit.update((m) => ({ ...m, modules: toggleModule(m.modules, id) }));
  }
  protected async saveModules(u: ManagedUser) {
    const { modules } = this.modulesEdit();
    if (!modules.length) {
      this.toast.error('Оберіть хоча б один модуль');
      return;
    }
    await this.run(
      () => this.usersService.update(u.id, { modules }),
      'Модулі змінено. Користувач увійде знову — сесії оновлено',
    );
    this.modulesEdit.set({ id: '', modules: [] });
  }

  protected canManage(u: ManagedUser) {
    return canManageUser(this.auth.user(), u);
  }

  /** The «⋯» menu of a row: what the signed-in user may do with this account. */
  protected userActions(u: ManagedUser): MenuAction[] {
    const actions: MenuAction[] = [];
    if (this.editModel().id !== u.id)
      actions.push({
        label: 'Редагувати',
        icon: 'edit',
        hint: 'Ім’я та email для входу',
        run: () => this.startEdit(u),
      });
    if (u.role !== 'ADMIN' && this.modulesEdit().id !== u.id)
      actions.push({
        label: 'Модулі',
        icon: 'columns',
        hint: 'Які застосунки відкриваються: військовий облік, кадри…',
        run: () => this.startModules(u),
      });
    if (this.lockedIds().has(u.id))
      actions.push({
        label: 'Розблокувати вхід',
        icon: 'key',
        hint: 'Вхід заблоковано після невдалих спроб',
        run: () => this.unlock(u),
      });
    if (u.isActive)
      actions.push({
        label: 'Лист на зміну пароля',
        icon: 'mail',
        hint: 'Посилання на пошту; до зміни — лише сторінка пароля',
        run: () => this.requestPasswordChange(u),
      });
    if (u.mfaEnabledAt)
      actions.push({
        label: 'Скинути вхід з кодом',
        icon: 'shield',
        hint: 'Загублено телефон: застосунок налаштовується наново під час входу',
        run: () => this.resetMfa(u),
      });
    actions.push({
      label: 'Скинути пароль',
      icon: 'lock',
      hint: 'Новий тимчасовий пароль; старий перестає діяти одразу',
      run: () => this.resetPassword(u),
    });
    if (u.id !== this.auth.user()?.id)
      actions.push(
        u.isActive
          ? {
              label: 'Заблокувати',
              icon: 'x',
              danger: true,
              hint: 'Усі сесії завершаться одразу',
              run: () => this.toggle(u),
            }
          : { label: 'Активувати', icon: 'check', run: () => this.toggle(u) },
      );
    return actions;
  }

  /** The temporary password no longer opens the account — the row says so and points to «Скинути пароль». */
  protected expired(u: ManagedUser) {
    return temporaryPasswordExpired(u, this.now());
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
      const problems = temporaryPasswordProblems(value(), valueOf(p.email));
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

  /** «Редагувати»: name and e-mail of one user, right in the table. */
  protected readonly editModel = signal<UserEditModel>({ id: '', fullName: '', email: '' });
  protected readonly editForm = form(this.editModel, (p) => {
    required(p.fullName, { message: 'Вкажіть ім’я' });
    maxLength(p.fullName, 200, { message: 'Не більше 200 символів' });
    required(p.email, { message: 'Вкажіть email' });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    maxLength(p.email, 200, { message: 'Не більше 200 символів' });
  });

  protected startEdit(u: ManagedUser) {
    this.editModel.set({ id: u.id, fullName: u.fullName, email: u.email });
    this.editForm().reset();
  }

  protected cancelEdit() {
    this.editModel.set({ id: '', fullName: '', email: '' });
  }

  protected async saveEdit(event: Event, u: ManagedUser) {
    event.preventDefault();
    const emailChanged = this.editModel().email.trim().toLowerCase() !== u.email;
    if (
      emailChanged &&
      !(await this.dialogs.confirm({
        title: `Змінити email для входу на ${this.editModel().email.trim()}?`,
        text: `Сесії «${u.fullName}» буде завершено, лист прийде на стару й нову адреси.`,
        confirmLabel: 'Змінити email',
        tone: 'warning',
      }))
    )
      return;
    await submit(this.editForm, async () => {
      try {
        const { fullName, email } = this.editModel();
        await this.usersService.update(u.id, { fullName: fullName.trim(), email: email.trim() });
        this.cancelEdit();
        this.toast.success(emailChanged ? 'Збережено. Email для входу змінено' : 'Збережено');
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.editForm, (m) => this.toast.error(m));
      }
    });
  }

  protected async create(event: Event) {
    event.preventDefault();
    await submit(this.userForm, async () => {
      try {
        const { legalEntityId, ...rest } = this.userModel();
        const created = await this.usersService.create({
          ...rest,
          legalEntityId: rest.role === 'ADMIN' ? null : legalEntityId || null,
          modules: this.newModules(),
        });
        this.userModel.set({ ...this.blank });
        this.newModules.set(['oblik']);
        this.userForm().reset();
        const until = created.temporaryPasswordExpiresAt
          ? ` Тимчасовий пароль діє до ${KYIV_DATETIME.format(new Date(created.temporaryPasswordExpiresAt))}.`
          : '';
        this.toast.success(
          `Користувача створено. Лист з паролем надіслано на його email (якщо пошту налаштовано); при першому вході він змінить пароль.${until}`,
        );
        await this.refresh();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.userForm, (m) => this.toast.error(m));
      }
    });
  }

  protected toggle(u: ManagedUser) {
    if (!u.isActive)
      return this.restore(() => this.usersService.update(u.id, { isActive: true }), 'Розблоковано');
    return this.run(
      () => this.usersService.update(u.id, { isActive: false }),
      'Заблоковано, сесії завершено',
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

  /** A lost phone without the recovery codes: the sessions end, the app is set up again at the next sign-in. */
  protected resetMfa(u: ManagedUser) {
    return this.run(
      () => this.usersService.resetMfa(u.id),
      `Вхід з кодом для «${u.fullName}» скинуто. Під час наступного входу застосунок налаштовується наново.`,
    );
  }

  protected unlock(u: ManagedUser) {
    return this.restore(() => this.usersService.unlock(u.id), 'Вхід розблоковано');
  }

  /**
   * «Розблокувати вхід» / «Активувати» give the access back but not an expired temporary password: the old one
   * still does not open the account. The administrator is told at once and may issue a new one right away.
   */
  private async restore(action: () => Promise<ManagedUser>, success: string) {
    try {
      const user = await action();
      await this.refresh();
      if (!temporaryPasswordExpired(user)) {
        this.toast.success(success);
        return;
      }
      this.toast.error(
        `${success}, але тимчасовий пароль «${user.fullName}» прострочено — зі старим увійти не вийде.`,
      );
      await this.resetPassword(
        user,
        `Видати «${user.fullName}» новий тимчасовий пароль?`,
        'Старий тимчасовий пароль прострочено, тому з ним увійти не вийде.',
      );
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  /** Letter 2: «change your password» with a link; until changed the user gets only the password page. */
  protected async requestPasswordChange(u: ManagedUser) {
    const ok = await this.dialogs.confirm({
      title: `Надіслати «${u.fullName}» лист на зміну пароля?`,
      text: 'До зміни пароля він зможе відкрити лише сторінку пароля.',
      confirmLabel: 'Надіслати лист',
      icon: 'send',
    });
    if (!ok) return;
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

  protected async resetPassword(
    u: ManagedUser,
    question = `Скинути пароль для «${u.fullName}»?`,
    text = 'Усі його сесії буде завершено, новий тимчасовий пароль ви побачите тут.',
  ) {
    const ok = await this.dialogs.confirm({
      title: question,
      text,
      confirmLabel: 'Видати тимчасовий пароль',
      tone: 'warning',
      icon: 'lock',
    });
    if (!ok) return;
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
