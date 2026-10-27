import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-letter-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    LetterStatusBadgeComponent,
    UaDatePipe,
    UaDateTimePipe,
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

  /** Letter from letterDetailsResolver; after changes the resolver is re-run. */
  readonly letter = input.required<LetterDetails>();
  /** E-signing state (letterSigningResolver) and widget settings (signingConfigResolver). */
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
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Позначити лист як переданий у ТЦК? Після цього його не можна редагувати.')
    ) {
      return;
    }
    await this.mutate(
      () => this.lettersService.markSent(this.id()),
      'Позначено як переданий у ТЦК',
    );
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
