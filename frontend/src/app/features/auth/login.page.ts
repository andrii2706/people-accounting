import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api.interceptor';
import { AuthStore } from '../../core/auth/auth.store';
import { FormFieldWrapper } from '../../shared/form-field';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormFieldWrapper, Icon],
  template: `
    <div class="grid min-h-screen lg:grid-cols-[1fr_520px]">
      <section class="relative hidden overflow-hidden bg-brand-900 p-12 text-brand-100 lg:flex lg:flex-col lg:justify-between">
        <div class="flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-lg bg-brand-500/30"><app-icon name="shield" [size]="22" /></span>
          <span class="text-sm font-semibold tracking-wide text-white">Військовий облік</span>
        </div>
        <div class="max-w-lg">
          <h1 class="text-4xl leading-tight font-semibold text-white">Облік призовників, військовозобов’язаних та резервістів</h1>
          <p class="mt-4 text-brand-200/80">
            Картки працівників, списки за Додатком 13, відомість оперативного обліку та повідомлення ТЦК — без ручних формул і копіювання між аркушами.
          </p>
        </div>
        <p class="text-xs text-brand-200/60">Порядок, затверджений постановою КМУ від 30.12.2022 № 1487</p>
        <div class="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[48px] border-brand-500/10"></div>
      </section>

      <section class="flex items-center justify-center p-6 sm:p-12">
        <form class="w-full max-w-sm" (submit)="onSubmit($event)" novalidate>
          <h2 class="text-2xl font-semibold tracking-tight">Вхід</h2>
          <p class="mt-1 mb-8 text-sm text-muted">Увійдіть обліковим записом, який видав адміністратор.</p>

          <div class="space-y-4">
            <app-form-field label="Email" [field]="loginForm.email" [required]="true">
              <input class="input" type="email" autocomplete="username" [formField]="loginForm.email" />
            </app-form-field>
            <app-form-field label="Пароль" [field]="loginForm.password" [required]="true">
              <input class="input" type="password" autocomplete="current-password" [formField]="loginForm.password" />
            </app-form-field>
          </div>

          @if (error()) {
            <p class="mt-4 rounded-lg border border-danger/20 bg-[#fdf1ef] px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="btn btn-primary mt-6 w-full py-2.5" [disabled]="loginForm().submitting()">
            {{ loginForm().submitting() ? 'Входимо…' : 'Увійти' }}
          </button>
        </form>
      </section>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** ?returnUrl=… з адреси (withComponentInputBinding). */
  readonly returnUrl = input<string>('/');

  protected readonly error = signal('');
  protected readonly model = signal({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (p) => {
    required(p.email, { message: 'Вкажіть email' });
    email(p.email, { message: 'Некоректний email' });
    required(p.password, { message: 'Вкажіть пароль' });
  });

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
