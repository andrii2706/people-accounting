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
import { KEP_SIGN_TOOLS, MAX_SIGNATURE_BYTES } from '../../constants/signature.constants';
import type { SignDocument, WidgetConfig } from '../../interfaces/auth.interface';
import type { SigningMode } from '../../interfaces/signature.interface';
import { IitSignWidgetService } from '../../services/iit-sign-widget.service';
import { ToastService } from '../../services/toast.service';
import { fromBase64, saveBytes, toBase64 } from '../../utils/file.utils';
import { IconComponent } from '../icon/icon.component';

/**
 * Signing a document the server offered with a qualified e-signature: right here with the IIT widget
 * (when configured) or with any KEP program — download the file, sign it (CAdES, detached .p7s), add the .p7s.
 * Emits the signature in base64; the page sends it to the server, which checks it.
 */
@Component({
  selector: 'app-kep-sign',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  templateUrl: './kep-sign.component.html',
})
export class KepSignComponent implements OnDestroy {
  private readonly widget = inject(IitSignWidgetService);
  private readonly toast = inject(ToastService);

  readonly document = input.required<SignDocument>();
  readonly widgetConfig = input.required<WidgetConfig>();
  /** The page is sending / checking the signature. */
  readonly busy = input(false);
  /** Who must sign — shown in the hints. */
  readonly signer = input('керівник');
  readonly signed = output<string>();

  protected readonly tools = KEP_SIGN_TOOLS;
  protected readonly containerId = `iit-sign-${Math.random().toString(36).slice(2, 8)}`;
  private readonly selectedMode = signal<SigningMode | null>(null);
  protected readonly mode = computed<SigningMode>(
    () => this.selectedMode() ?? (this.widgetConfig().enabled ? 'widget' : 'upload'),
  );
  protected readonly stage = signal<'idle' | 'reading' | 'ready' | 'signing'>('idle');

  ngOnDestroy() {
    this.widget.close();
  }

  protected setMode(mode: SigningMode) {
    this.selectedMode.set(mode);
    if (mode !== 'widget') this.reset();
  }

  protected download() {
    const doc = this.document();
    saveBytes(fromBase64(doc.content), doc.fileName, 'text/plain;charset=utf-8');
  }

  protected async readKey() {
    const { scriptUrl, frameUrl } = this.widgetConfig();
    this.stage.set('reading');
    try {
      await this.widget.readKey(this.containerId, scriptUrl, frameUrl);
      this.stage.set('ready');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Не вдалося зчитати ключ');
      this.reset();
    }
  }

  protected async signHere() {
    this.stage.set('signing');
    try {
      const signature = await this.widget.signDetached(fromBase64(this.document().content));
      this.signed.emit(signature);
      this.stage.set('ready');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Не вдалося підписати');
      this.stage.set('ready');
    }
  }

  protected reset() {
    this.widget.close();
    this.stage.set('idle');
  }

  protected async upload(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (file.size > MAX_SIGNATURE_BYTES) {
      this.toast.error('Файл завеликий. Оберіть файл .p7s з окремим (detached) підписом.');
      return;
    }
    this.signed.emit(toBase64(await file.arrayBuffer()));
  }
}
