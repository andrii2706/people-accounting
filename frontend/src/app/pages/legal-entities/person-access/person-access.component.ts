import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PhoneInputComponent } from '../../../shared/components/phone-input/phone-input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { ROLE_LABELS } from '../../../shared/constants/auth.constants';
import { ACCESS_ROLE_OPTIONS, PERSON_TEXT } from '../../../shared/constants/legal-entity.constants';
import type { IssuedPassword } from '../../../shared/interfaces/auth.interface';
import type {
  AccessRole,
  ChangePersonForm,
  EntityPerson,
  GrantAccessRequest,
  GrantAccessResult,
  PersonAccess,
} from '../../../shared/interfaces/legal-entity.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../shared/services/auth.service';
import { apiErrorMessage, formSubmitErrors } from '../../../shared/utils/api-error.utils';
import { MESSAGE, PATTERN } from '../../../shared/validators/employee-rules';

/**
 * Access of the head / the responsible person to the system and the replacement of the person.
 * Login is their e-mail; a new account gets a temporary password that the administrator sees once
 * and hands over personally — on first sign-in the person sets their own.
 */
@Component({
  selector: 'app-person-access',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FormFieldComponent,
    IconComponent,
    PhoneInputComponent,
    SelectComponent,
    UaDateTimePipe,
  ],
  templateUrl: './person-access.component.html',
})
export class PersonAccessComponent {
  private readonly service = inject(LegalEntitiesService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly entityId = input.required<string>();
  readonly person = input.required<EntityPerson>();
  /** The current name of the person (saved). */
  readonly personName = input('');
  readonly access = input<PersonAccess | null>(null);
  /** Something changed on the server — the page reloads the entity. */
  readonly changed = output<void>();

  protected readonly text = computed(() => PERSON_TEXT[this.person()]);
  /** The entity administrator role is given only by the main administrator. */
  protected readonly roleOptions = computed(() =>
    this.auth.isAdmin()
      ? ACCESS_ROLE_OPTIONS
      : ACCESS_ROLE_OPTIONS.filter((o) => o.value !== 'ENTITY_ADMIN'),
  );
  protected readonly roleLabels: Record<string, string> = ROLE_LABELS;
  protected readonly busy = signal(false);
  /** A temporary password issued just now — shown once. */
  protected readonly issued = signal<IssuedPassword | null>(null);

  // give access to the current person
  /** The head usually gets the director role (view and sign), the responsible person — HR. */
  protected readonly defaultRole = computed<AccessRole>(() =>
    this.person() === 'HEAD' ? 'DIRECTOR' : 'HR',
  );
  protected readonly grantModel = linkedSignal<GrantAccessRequest>(() => ({
    email: '',
    role: this.defaultRole(),
  }));
  protected readonly grantForm = form(this.grantModel, (p) => {
    required(p.email, { message: 'Вкажіть email — це логін для входу' });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
    maxLength(p.email, 200, { message: MESSAGE.tooLong(200) });
  });

  protected async grant(event: Event) {
    event.preventDefault();
    await submit(this.grantForm, async () => {
      try {
        const m = this.grantModel();
        const result = await this.service.grantAccess(this.entityId(), this.person(), {
          email: m.email.trim(),
          role: m.role,
        });
        this.showResult(result);
        this.grantModel.set({ email: '', role: this.defaultRole() });
        this.grantForm().reset();
        this.changed.emit();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.grantForm, (message) => this.toast.error(message));
      }
    });
  }

  protected async revoke() {
    const access = this.access();
    if (!access) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Скасувати доступ ${access.email}? Обліковий запис буде вимкнено, активні сеанси завершаться.`,
      )
    )
      return;
    this.busy.set(true);
    try {
      const result = await this.service.revokeAccess(this.entityId(), this.person());
      this.toast.success(
        result.deactivated
          ? `Доступ ${result.email} скасовано`
          : `${result.email} відв’язано від цієї юрособи; доступ лишився — він потрібен в іншій юрособі`,
      );
      this.changed.emit();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  // replace the person (a new head / responsible)
  protected readonly changing = signal(false);
  protected readonly changeModel = signal<ChangePersonForm>({
    fullName: '',
    position: '',
    phone: '',
    revokePrevious: true,
    email: '',
    role: 'HR',
  });
  protected readonly changeForm = form(this.changeModel, (p) => {
    required(p.fullName, { message: 'Вкажіть ім’я та ПРІЗВИЩЕ' });
    maxLength(p.fullName, 200, { message: MESSAGE.tooLong(200) });
    maxLength(p.position, 200, { message: MESSAGE.tooLong(200) });
    pattern(p.phone, PATTERN.phoneE164, { message: MESSAGE.phoneE164 });
    pattern(p.email, PATTERN.email, { message: MESSAGE.email });
  });

  private emptyChange(): ChangePersonForm {
    return {
      fullName: '',
      position: '',
      phone: '',
      revokePrevious: true,
      email: '',
      role: this.defaultRole(),
    };
  }

  protected startChange() {
    this.changeModel.set(this.emptyChange());
    this.changeForm().reset();
    this.changing.set(true);
  }

  protected setChangeRole(role: string) {
    this.changeModel.update((m) => ({ ...m, role: role as AccessRole }));
  }

  protected setGrantRole(role: string) {
    this.grantModel.update((m) => ({ ...m, role: role as AccessRole }));
  }

  protected async change(event: Event) {
    event.preventDefault();
    await submit(this.changeForm, async () => {
      try {
        const m = this.changeModel();
        const result = await this.service.changePerson(this.entityId(), this.person(), {
          fullName: m.fullName.trim(),
          position: m.position.trim(),
          ...(this.person() === 'RESPONSIBLE' ? { phone: m.phone } : {}),
          revokePrevious: m.revokePrevious,
          ...(m.email.trim() ? { email: m.email.trim(), role: m.role } : {}),
        });
        this.changing.set(false);
        if (result.granted) {
          this.showResult(result.granted);
        } else {
          this.toast.success(`${this.text().who} — ${m.fullName.trim()}`);
        }
        this.changed.emit();
        return undefined;
      } catch (err) {
        return formSubmitErrors(err, this.changeForm, (message) => this.toast.error(message));
      }
    });
  }

  private showResult(result: GrantAccessResult) {
    const email = result.access.email;
    if (result.temporaryPassword) {
      this.issued.set({
        user: email,
        password: result.temporaryPassword,
        mailedTo: result.mailSent ? email : '',
        expiresAt: result.expiresAt,
      });
    } else {
      this.toast.success(`Доступ надано: ${email} (наявний обліковий запис, пароль не змінено)`);
    }
  }

  protected async copyPassword() {
    const issued = this.issued();
    if (!issued || typeof navigator === 'undefined') return;
    await navigator.clipboard.writeText(issued.password);
    this.toast.success('Скопійовано');
  }
}
