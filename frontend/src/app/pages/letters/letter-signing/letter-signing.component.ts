import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnDestroy,
  output,
  signal,
} from '@angular/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { LetterStatus } from '../../../shared/interfaces/letter.interface';
import type {
  SigningConfig,
  SigningState,
  SigningMode,
} from '../../../shared/interfaces/signature.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { IitSignWidgetService } from '../../../shared/services/iit-sign-widget.service';
import { SignaturesService } from '../../../shared/services/signatures.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { SIGNATURE_VERIFICATION_BADGES } from '../../../shared/constants/badges.constants';
import { MAX_SIGNATURE_BYTES } from '../../../shared/constants/signature.constants';
import { toBase64 } from '../../../shared/utils/file.utils';

/**
 * Qualified e-signature panel of a letter.
 * 1) freeze the document → 2) sign with the IIT widget or upload a .p7s from any program → 3) package for the TCK.
 */
@Component({
  selector: 'app-letter-signing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, UaDateTimePipe],
  host: { class: 'block' },
  templateUrl: './letter-signing.component.html',
})
export class LetterSigningComponent implements OnDestroy {
  protected readonly signatures = inject(SignaturesService);
  private readonly widget = inject(IitSignWidgetService);
  private readonly toast = inject(ToastService);

  readonly letterId = input.required<string>();
  readonly letterStatus = input.required<LetterStatus>();
  readonly state = input.required<SigningState>();
  readonly config = input.required<SigningConfig>();
  /** State changed — the parent page re-runs its resolvers. */
  readonly changed = output<void>();

  protected readonly verification = SIGNATURE_VERIFICATION_BADGES;
  protected readonly widgetContainerId = 'iit-sign-widget';
  protected readonly busy = signal(false);
  protected readonly selectedMode = signal<SigningMode | null>(null);
  protected readonly mode = computed<SigningMode>(
    () => this.selectedMode() ?? (this.config().widget.enabled ? 'widget' : 'upload'),
  );
  protected readonly widgetStage = signal<'idle' | 'reading' | 'ready' | 'signing'>('idle');
  protected readonly shortHash = computed(() => {
    const h = this.state().documentSha256 ?? '';
    return h ? `${h.slice(0, 8)}…${h.slice(-8)}` : '';
  });
  protected readonly hasSignatures = computed(() => this.state().signatures.length > 0);

  ngOnDestroy() {
    this.widget.close();
  }

  protected setMode(mode: SigningMode) {
    this.selectedMode.set(mode);
    if (mode !== 'widget') this.resetWidget();
  }

  protected async freeze() {
    await this.run(
      () => this.signatures.freeze(this.letterId()),
      'Документ зафіксовано для підпису',
    );
  }

  protected async unfreeze() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Скасувати фіксацію? Документ буде згенеровано заново з поточних даних.')
    ) {
      return;
    }
    await this.run(() => this.signatures.unfreeze(this.letterId()), 'Фіксацію скасовано');
  }

  protected async readKey() {
    const { scriptUrl, frameUrl } = this.config().widget;
    this.widgetStage.set('reading');
    try {
      await this.widget.readKey(this.widgetContainerId, scriptUrl, frameUrl);
      this.widgetStage.set('ready');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Не вдалося зчитати ключ');
      this.resetWidget();
    }
  }

  protected async signWithWidget() {
    if (this.busy()) return;
    this.busy.set(true);
    this.widgetStage.set('signing');
    try {
      const data = new Uint8Array(await this.signatures.signingFile(this.letterId()));
      const signature = await this.widget.signDetached(data);
      await this.signatures.add(this.letterId(), signature, 'WIDGET');
      this.toast.success('Документ підписано');
      this.resetWidget();
      this.changed.emit();
    } catch (err) {
      this.toast.error(
        err instanceof Error && !('status' in err) ? err.message : apiErrorMessage(err),
      );
      this.widgetStage.set('ready');
    } finally {
      this.busy.set(false);
    }
  }

  protected resetWidget() {
    this.widget.close();
    this.widgetStage.set('idle');
  }

  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_SIGNATURE_BYTES) {
      this.toast.error('Файл завеликий для підпису. Оберіть файл .p7s з окремим підписом.');
      return;
    }
    const base64 = toBase64(await file.arrayBuffer());
    await this.run(() => this.signatures.add(this.letterId(), base64, 'UPLOAD'), 'Підпис додано');
  }

  private async run(action: () => Promise<unknown>, success: string) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
      this.toast.success(success);
      this.changed.emit();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
