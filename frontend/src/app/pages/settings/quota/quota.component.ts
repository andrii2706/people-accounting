import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type {
  QuotaNotifySettings,
  QuotaPageData,
  QuotaRecalculation,
} from '../../../shared/interfaces/legal-entity.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { percentText } from '../../../shared/utils/legal-entity.utils';
import { QUOTA_NOTIFY_OPTIONS } from '../../../shared/constants/legal-entity.constants';

/**
 * The reservation quota of a legal entity: the numbers now, every recalculation (it is recalculated by itself after
 * hiring, dismissal, reservation, a new percent and once a day) and which e-mails it sends.
 */
@Component({
  selector: 'app-quota',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, RouterLink, UaDatePipe, UaDateTimePipe],
  templateUrl: './quota.component.html',
})
export class QuotaComponent {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(LegalEntitiesService);
  private readonly toast = inject(ToastService);

  /** quotaResolver */
  readonly data = input.required<QuotaPageData>();
  protected readonly q = computed(() => this.data().quota);
  protected readonly over = computed(() => {
    const q = this.q();
    return q.quota !== null ? Math.max(q.reservedCompany - q.quota, 0) : 0;
  });
  protected readonly notify = linkedSignal(() => this.data().notify);
  protected readonly saving = signal<keyof QuotaNotifySettings | null>(null);
  protected readonly options = QUOTA_NOTIFY_OPTIONS;
  protected readonly percent = percentText;
  protected readonly last = computed(() => this.data().recalculations[0] ?? null);

  /** «11 → 10» or «10». */
  protected step(prev: number | null, now: number | null): string {
    return prev !== null && prev !== now ? `${prev} → ${now ?? '—'}` : String(now ?? '—');
  }

  protected state(r: QuotaRecalculation): { label: string; tone: 'bad' | 'warn' | 'ok' | 'muted' } {
    if (r.quota === null) return { label: 'квоту не задано', tone: 'muted' };
    if (r.exceeded) return { label: `перевищено на ${r.reservedCompany - r.quota}`, tone: 'bad' };
    if (r.available === 0) return { label: '0 вільних', tone: 'warn' };
    return { label: `вільних ${r.available}`, tone: 'ok' };
  }

  protected async toggle(key: keyof QuotaNotifySettings, value: boolean) {
    this.saving.set(key);
    try {
      this.notify.set(await this.service.saveQuotaNotify(this.data().entityId, { [key]: value }));
      this.toast.success(value ? 'Лист увімкнено' : 'Лист вимкнено');
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.saving.set(null);
    }
  }
}
