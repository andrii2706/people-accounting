import { REPORT_NAMES } from '../../../shared/constants/lists.constants';
import {
  BILLING_CLOSED_TEXT,
  PORTAL_HOME,
  SSO_FAILURE_TEXT,
} from '../../../shared/constants/auth.constants';
import { COPYRIGHT_TEXT } from '../../../shared/constants/subscription.constants';
import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { FormAlertComponent } from '../../../shared/components/form-alert/form-alert.component';
import { LoginPreviewComponent } from './login-preview/login-preview.component';
import { AccountService } from '../../../shared/services/account.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';
import { AuthService } from '../../../shared/services/auth.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { CodeInputComponent } from '../../../shared/components/code-input/code-input.component';
import { RecoveryCodesComponent } from '../../../shared/components/recovery-codes/recovery-codes.component';
import { TwoFactorSetupComponent } from '../../../shared/components/two-factor-setup/two-factor-setup.component';
import type { LoginStep, SsoFailure } from '../../../shared/interfaces/auth.interface';
import { isCodeLike, normalizeCode } from '../../../shared/utils/two-factor.utils';
import type { LoginChallenge, TwoFactorSetup } from '../../../../platform/contracts/session';
import { UiBusyDirective } from '@mr/ui';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiBusyDirective,
    PasswordInputComponent,
    FormField,
    FormFieldComponent,
    AppIconComponent,
    RouterLink,
    CodeInputComponent,
    RecoveryCodesComponent,
    TwoFactorSetupComponent,
    FormAlertComponent,
    LoginPreviewComponent,
    NgTemplateOutlet,
  ],
  host: { class: 'flex min-h-dvh bg-canvas' },
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
  /** ?reason=sso&sso=keys — why the entrance from the portal was refused. */
  readonly sso = input<string>('');

  /** The text of a refused entrance from the portal; an unknown code — the general one. */
  protected readonly ssoMessage = computed(() =>
    this.reason() === 'sso'
      ? (SSO_FAILURE_TEXT[this.sso() as SsoFailure] ?? SSO_FAILURE_TEXT.invalid)
      : '',
  );
  protected readonly portalHome = PORTAL_HOME;

  protected readonly error = signal('');
  /** ?reason=billing — the module was closed for a debt (the text of the API, if it came). */
  protected readonly closedMessage = this.auth.closedMessage;
  protected readonly billingClosedText = BILLING_CLOSED_TEXT;
  protected readonly copyright = COPYRIGHT_TEXT;
  /** The password → the code from the app (or setting the app up) → the recovery codes. */
  protected readonly step = signal<LoginStep>('password');
  private readonly challenge = signal<LoginChallenge | null>(null);
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly code = signal('');
  /** The phone is not at hand — a recovery code instead. */
  protected readonly recovery = signal(false);
  protected readonly busy = signal(false);
  protected readonly codeReady = computed(() => isCodeLike(this.code()));
  /** The link «Зареєструвати компанію» — when the self sign-up is on. */
  protected readonly signupEnabled = signal(false);
  /** The three reports — each its own paragraph under the title (the left panel). */
  protected readonly reportNames = [
    REPORT_NAMES.lists,
    REPORT_NAMES.operational,
    REPORT_NAMES.extracts,
  ];
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
        const answer = await this.auth.login(e, password);
        if ('twoFactor' in answer) await this.second(answer);
        else await this.done();
      } catch (err) {
        this.error.set(apiErrorMessage(err, 'Не вдалося увійти'));
      }
      return undefined;
    });
  }

  /** The password was right: the code from the app is asked, or the app is set up first. */
  private async second(challenge: LoginChallenge) {
    this.challenge.set(challenge);
    this.code.set('');
    this.recovery.set(false);
    if (challenge.twoFactor === 'CODE') {
      this.step.set('code');
      return;
    }
    this.setup.set(await this.auth.loginSetup(challenge.ticket));
    this.step.set('setup');
  }

  protected async sendCode() {
    const ticket = this.challenge()?.ticket;
    if (!ticket || !this.codeReady() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.loginCode(ticket, normalizeCode(this.code()));
      await this.done();
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Не вдалося увійти'));
      this.code.set('');
      if (/Увійдіть ще раз|заблоковано/.test(this.error())) this.back(false);
    } finally {
      this.busy.set(false);
    }
  }

  protected async enable(code: string) {
    const ticket = this.challenge()?.ticket;
    if (!ticket) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { recoveryCodes } = await this.auth.loginEnable(ticket, code);
      this.recoveryCodes.set(recoveryCodes);
      this.step.set('codes');
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Код не підходить'));
      if (/Увійдіть ще раз/.test(this.error())) this.back(false);
    } finally {
      this.busy.set(false);
    }
  }

  protected async codesSaved() {
    this.auth.finishSetup();
    await this.done();
  }

  /** Back to the password (another account, or the ticket has run out). */
  protected back(clearError = true) {
    this.step.set('password');
    this.challenge.set(null);
    this.setup.set(null);
    this.code.set('');
    if (clearError) this.error.set('');
    this.model.update((m) => ({ ...m, password: '' }));
  }

  protected toggleRecovery() {
    this.recovery.update((v) => !v);
    this.code.set('');
    this.error.set('');
  }

  private async done() {
    await this.router.navigateByUrl(this.returnUrl() || '/');
  }
}
