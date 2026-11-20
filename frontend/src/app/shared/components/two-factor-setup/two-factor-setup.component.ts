import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { TwoFactorSetup } from '../../../../platform/contracts/session';
import { AUTHENTICATOR_APPS } from '../../constants/security.constants';
import { isCodeLike, normalizeCode } from '../../utils/two-factor.utils';
import { CodeInputComponent } from '../code-input/code-input.component';
import { QrCodeComponent } from '../qr-code/qr-code.component';

/**
 * Setting up the authenticator app: install it, scan the QR code (or type the key), enter the 6 digits.
 * The parent sends the code to the server and shows its error.
 */
@Component({
  selector: 'app-two-factor-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QrCodeComponent, CodeInputComponent],
  template: `
    <ol class="space-y-5 text-sm">
      <li>
        <p class="font-medium text-ink">1. Встановіть на телефон застосунок для кодів</p>
        <p class="mt-1 text-muted">{{ apps }} — будь-який із них.</p>
      </li>
      <li>
        <p class="font-medium text-ink">2. Додайте обліковий запис: відскануйте QR-код</p>
        <div class="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <app-qr-code
            class="size-52 shrink-0 border border-line p-1"
            [qr]="setup().qr"
            label="QR-код для застосунку"
          />
          <div class="min-w-0 text-muted">
            <p>Немає камери? Введіть ключ вручну:</p>
            <p class="mt-2 font-mono text-sm break-all text-ink select-all">{{ setup().secret }}</p>
            <p class="mt-2 text-xs">Тип — «за часом», 6 цифр.</p>
          </div>
        </div>
      </li>
      <li>
        <label class="font-medium text-ink" for="setup-code"
          >3. Введіть 6 цифр, які показує застосунок</label
        >
        <app-code-input
          class="mt-2"
          inputId="setup-code"
          [autofocus]="false"
          [invalid]="!!error()"
          [describedBy]="error() ? 'setup-error' : ''"
          [(value)]="code"
          (enter)="submit()"
        />
      </li>
    </ol>
    @if (error()) {
      <p
        id="setup-error"
        class="mt-4 rounded-lg border border-danger/20 bg-[#fdf1ef] px-3 py-2 text-sm text-danger"
        role="alert"
      >
        {{ error() }}
      </p>
    }
    <button
      type="button"
      class="btn btn-primary mt-6 w-full cursor-pointer py-2.5"
      [disabled]="busy() || !ready()"
      (click)="submit()"
    >
      {{ busy() ? 'Перевіряємо…' : submitLabel() }}
    </button>
  `,
})
export class TwoFactorSetupComponent {
  readonly setup = input.required<TwoFactorSetup>();
  readonly busy = input(false);
  readonly error = input('');
  readonly submitLabel = input('Увімкнути');
  readonly confirm = output<string>();

  protected readonly apps = AUTHENTICATOR_APPS.join(', ');
  protected readonly code = signal('');
  protected readonly ready = computed(() => /^\d{6}$/.test(normalizeCode(this.code())));

  protected submit() {
    if (!this.ready() || this.busy() || !isCodeLike(this.code())) return;
    this.confirm.emit(normalizeCode(this.code()));
  }
}
