import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CodeInputComponent } from '../../../shared/components/code-input/code-input.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';
import { RecoveryCodesComponent } from '../../../shared/components/recovery-codes/recovery-codes.component';
import { TwoFactorSetupComponent } from '../../../shared/components/two-factor-setup/two-factor-setup.component';
import type { MfaStatus } from '../../../shared/interfaces/auth.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TwoFactorService } from '../../../shared/services/two-factor.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { isCodeLike, normalizeCode } from '../../../shared/utils/two-factor.utils';
import type { TwoFactorSetup } from '../../../../platform/contracts/session';

type Mode = 'idle' | 'password' | 'setup' | 'codes' | 'renew' | 'disable';

/** Profile → «Вхід з кодом»: turn it on, new recovery codes, turn it off (where the role allows). */
@Component({
  selector: 'app-two-factor-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CodeInputComponent,
    IconComponent,
    PasswordInputComponent,
    RecoveryCodesComponent,
    TwoFactorSetupComponent,
    UaDatePipe,
  ],
  templateUrl: './two-factor-card.component.html',
})
export class TwoFactorCardComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(TwoFactorService);
  private readonly toast = inject(ToastService);

  protected readonly status = signal<MfaStatus | null>(null);
  protected readonly mode = signal<Mode>('idle');
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly codes = signal<string[]>([]);
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly confirmReady = computed(() => !!this.password() && isCodeLike(this.code()));

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      this.status.set(await this.api.status());
    } catch {
      this.status.set(null);
    }
  }

  protected start(mode: Mode) {
    this.mode.set(mode);
    this.password.set('');
    this.code.set('');
    this.error.set('');
  }

  protected cancel() {
    this.start('idle');
    this.setup.set(null);
  }

  /** The password once more → a new secret for the app. */
  protected async begin(event: Event) {
    event.preventDefault();
    if (!this.password()) return;
    await this.run(async () => {
      this.setup.set(await this.api.setup(this.password()));
      this.password.set('');
      this.mode.set('setup');
    });
  }

  protected async enable(code: string) {
    await this.run(async () => {
      const result = await this.api.enable(code);
      this.codes.set(result.recoveryCodes);
      this.status.set(result.status);
      this.setup.set(null);
      this.mode.set('codes');
    });
  }

  protected async confirm(event: Event) {
    event.preventDefault();
    if (!this.confirmReady()) return;
    const password = this.password();
    const code = normalizeCode(this.code());
    await this.run(async () => {
      if (this.mode() === 'disable') {
        this.status.set(await this.api.disable(password, code));
        this.toast.success('Вхід з кодом вимкнено');
        this.start('idle');
      } else {
        const result = await this.api.renewCodes(password, code);
        this.codes.set(result.recoveryCodes);
        this.status.set(result.status);
        this.mode.set('codes');
      }
    });
  }

  protected codesSaved() {
    this.codes.set([]);
    this.start('idle');
    this.toast.success('Готово: вхід захищено кодом');
  }

  private async run(work: () => Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try {
      await work();
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
