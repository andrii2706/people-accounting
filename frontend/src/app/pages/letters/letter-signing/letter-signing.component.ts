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
  SignatureVerification,
  SigningConfig,
  SigningState,
} from '../../../shared/interfaces/signature.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { IitSignWidgetService } from '../../../shared/services/iit-sign-widget.service';
import { SignaturesService } from '../../../shared/services/signatures.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';

const MAX_SIGNATURE_BYTES = 700 * 1024;

const VERIFICATION: Record<SignatureVerification, { label: string; cls: string; hint: string }> = {
  VALID: {
    label: 'Підпис дійсний',
    cls: 'bg-[#e3f1e5] text-ok',
    hint: 'Документ збігається, підпис перевірено криптографічно.',
  },
  DIGEST_MATCH: {
    label: 'Документ збігається',
    cls: 'bg-[#e8f0f8] text-info',
    hint: 'Підпис зроблено саме під цей документ. Підпис ДСТУ 4145 і статус сертифіката остаточно перевіряє сервіс ЦЗО.',
  },
  UNVERIFIED: {
    label: 'Не перевірено',
    cls: 'bg-[#fdf6ec] text-warning',
    hint: 'Алгоритм не підтримується сервером — перевірте підпис на сервісі ЦЗО.',
  },
};

type Mode = 'widget' | 'upload';

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Панель підписання листа КЕП.
 * 1) фіксація документа → 2) підпис віджетом ІІТ або завантаження .p7s з будь-якої програми → 3) пакет для ТЦК.
 */
@Component({
  selector: 'app-letter-signing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, UaDateTimePipe],
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
  /** Стан змінився — батьківська сторінка перезапускає резолвери. */
  readonly changed = output<void>();

  protected readonly verification = VERIFICATION;
  protected readonly widgetContainerId = 'iit-sign-widget';
  protected readonly busy = signal(false);
  protected readonly selectedMode = signal<Mode | null>(null);
  protected readonly mode = computed<Mode>(
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

  protected setMode(mode: Mode) {
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

  // ---------------------------------------------------------------- віджет ІІТ

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

  // ---------------------------------------------------------------- завантаження .p7s

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
