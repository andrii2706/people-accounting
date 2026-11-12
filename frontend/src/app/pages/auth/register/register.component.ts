import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  email,
  form,
  FormField,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { from } from 'rxjs';
import { CopyrightComponent } from '../../../shared/components/copyright/copyright.component';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { KepSignComponent } from '../../../shared/components/kep-sign/kep-sign.component';
import {
  EMPTY_SIGNUP_FORM,
  SIGNUP_EDRPOU_PATTERN,
  SIGNUP_REJECTED,
} from '../../../shared/constants/subscription.constants';
import type {
  SignupStatement,
  SignupStatementRequest,
} from '../../../shared/interfaces/auth.interface';
import { AccountService } from '../../../shared/services/account.service';
import {
  apiErrorCode,
  apiErrorMessage,
  formSubmitErrors,
} from '../../../shared/utils/api-error.utils';
import { fromBase64 } from '../../../shared/utils/file.utils';

/**
 * Sign-up of a company by its head: the code of the legal entity + the work e-mail → the statement signed with
 * the head's KEP → the server compares the signer with the head in the ЄДР. Match — the temporary password comes
 * by e-mail; otherwise the user is sent to the sign-in page and the administrator is told.
 */
@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FormFieldComponent,
    IconComponent,
    RouterLink,
    CopyrightComponent,
    KepSignComponent,
  ],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);

  protected readonly info = rxResource({ stream: () => from(this.account.registerInfo()) });
  protected readonly statement = signal<SignupStatement | null>(null);
  protected readonly statementText = computed(() => {
    const s = this.statement();
    return s ? new TextDecoder().decode(fromBase64(s.content)) : '';
  });
  protected readonly checking = signal(false);
  protected readonly done = signal('');
  protected readonly error = signal('');

  protected readonly model = signal<SignupStatementRequest>({ ...EMPTY_SIGNUP_FORM });
  protected readonly registerForm = form(this.model, (p) => {
    required(p.edrpou, { message: 'Вкажіть код ЄДРПОУ' });
    pattern(p.edrpou, SIGNUP_EDRPOU_PATTERN, { message: 'Код ЄДРПОУ юридичної особи — 8 цифр' });
    required(p.email, { message: 'Вкажіть робочий email' });
    email(p.email, { message: 'Вкажіть email у форматі name@company.ua' });
    validate(p.consent, ({ value }) =>
      value()
        ? undefined
        : { kind: 'consent', message: 'Потрібна згода на обробку персональних даних' },
    );
  });

  /** Step 1: the statement to sign. */
  protected async onSubmit(event: Event) {
    event.preventDefault();
    this.error.set('');
    await submit(this.registerForm, async () => {
      try {
        const m = this.model();
        this.statement.set(
          await this.account.signupStatement({
            ...m,
            edrpou: m.edrpou.trim(),
            email: m.email.trim(),
          }),
        );
        return undefined;
      } catch (err) {
        this.error.set(apiErrorMessage(err, 'Не вдалося сформувати заяву'));
        return formSubmitErrors(err, this.registerForm, () => undefined);
      }
    });
  }

  /** Step 2: the head's signature → the check with the ЄДР. */
  protected async onSigned(signature: string) {
    const s = this.statement();
    if (!s || this.checking()) return;
    this.checking.set(true);
    this.error.set('');
    try {
      this.done.set((await this.account.signupSign(s.id, signature)).message);
    } catch (err) {
      if (apiErrorCode(err) === SIGNUP_REJECTED) {
        await this.router.navigate(['/login'], { queryParams: { signup: 'rejected' } });
        return;
      }
      this.error.set(apiErrorMessage(err, 'Не вдалося перевірити підпис'));
    } finally {
      this.checking.set(false);
    }
  }

  protected restart() {
    this.statement.set(null);
    this.error.set('');
  }
}
