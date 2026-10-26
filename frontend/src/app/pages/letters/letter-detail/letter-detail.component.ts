import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LetterStatusBadgeComponent } from '../../../shared/components/letter-status-badge/letter-status-badge.component';
import { LETTER_TYPE_LABELS } from '../../../shared/constants/letter.constants';
import type { LetterDetails } from '../../../shared/interfaces/letter.interface';
import type { SigningConfig, SigningState } from '../../../shared/interfaces/signature.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { LettersService } from '../../../shared/services/letters.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';
import { LetterSigningComponent } from '../letter-signing/letter-signing.component';

const DEFAULT_MESSAGE =
  'Добрий день!\n\nНадсилаємо документи з питань військового обліку працівників підприємства. Оригінали буде направлено поштою.';
const SIGNED_MESSAGE =
  'Добрий день!\n\nНадсилаємо документ з питань військового обліку працівників підприємства, підписаний кваліфікованим електронним підписом (файл .p7s — окремий підпис до документа).';

@Component({
  selector: 'app-letter-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    LetterStatusBadgeComponent,
    UaDatePipe,
    UaDateTimePipe,
    FormField,
    FormFieldComponent,
    LetterSigningComponent,
  ],
  templateUrl: './letter-detail.component.html',
})
export class LetterDetailComponent {
  protected readonly lettersService = inject(LettersService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly dict = inject(DictionariesService);

  readonly id = input.required<string>();

  /** Лист з letterDetailsResolver; після змін — повторний запуск резолвера. */
  readonly letter = input.required<LetterDetails>();
  /** Стан підписання КЕП (letterSigningResolver) і налаштування віджета (signingConfigResolver). */
  readonly signing = input.required<SigningState>();
  readonly signingConfig = input.required<SigningConfig>();
  protected readonly signed = computed(() => this.signing().signatures.length > 0);
  protected readonly l = computed(() => this.letter());
  private readonly refresh = injectRouteRefresh();
  protected readonly typeLabel = computed(() =>
    this.l() ? LETTER_TYPE_LABELS[this.l()!.type] : '',
  );

  protected readonly number = linkedSignal(() => this.l()?.number ?? '');
  protected readonly date = linkedSignal(() => this.l()?.date ?? '');

  protected readonly sendModel = linkedSignal(() => ({
    to: this.l()?.recipientEmail || this.l()?.tck?.email || '',
    cc: '',
    message: this.signing().signatures.length ? SIGNED_MESSAGE : DEFAULT_MESSAGE,
  }));
  protected readonly sendForm = form(this.sendModel, (p) => {
    required(p.to, { message: 'Вкажіть email ТЦК' });
    validate(p.to, ({ value }) =>
      value() && !/^\S+@\S+\.\S+$/.test(value())
        ? { kind: 'email', message: 'Некоректний email' }
        : undefined,
    );
    validate(p.cc, ({ value }) =>
      value() && !/^\S+@\S+\.\S+$/.test(value())
        ? { kind: 'email', message: 'Некоректний email' }
        : undefined,
    );
  });

  protected readonly changeTypes = computed(
    () => new Map((this.dict.dictionaries()?.changeTypes ?? []).map((c) => [c.value, c.label])),
  );
  protected changeLabel(type: string) {
    return this.changeTypes().get(type as never) ?? type;
  }

  protected async saveMeta() {
    await this.mutate(
      () => this.lettersService.update(this.id(), { number: this.number(), date: this.date() }),
      'Реквізити збережено',
    );
  }

  protected async changeTck(tckId: string) {
    await this.mutate(() => this.lettersService.update(this.id(), { tckId }), 'Адресата змінено');
  }

  protected refreshPage() {
    void this.refresh();
  }

  protected async markSent() {
    await this.mutate(() => this.lettersService.markSent(this.id()), 'Позначено як відправлений');
  }

  protected async send(event: Event) {
    event.preventDefault();
    await submit(this.sendForm, async () => {
      const { to, cc, message } = this.sendModel();
      await this.mutate(
        () => this.lettersService.send(this.id(), { to, cc: cc || undefined, message }),
        'Лист надіслано',
      );
      return undefined;
    });
  }

  protected async remove() {
    if (typeof window !== 'undefined' && !window.confirm('Видалити чернетку листа?')) return;
    try {
      await this.lettersService.remove(this.id());
      this.toast.success('Чернетку видалено');
      await this.router.navigate(['/letters']);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  private readonly saving = signal(false);
  private async mutate(action: () => Promise<unknown>, success: string) {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await action();
      this.toast.success(success);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
      await this.refresh();
    } finally {
      this.saving.set(false);
    }
  }
}
