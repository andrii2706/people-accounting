import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import {
  INVOICE_STATUS_LABELS,
  PLAN_LABELS,
  SUBSCRIPTION_STATE_LABELS,
} from '../../../shared/constants/subscription.constants';
import type {
  InvoiceView,
  VendorBillingData,
  VendorSubscriptionRow,
} from '../../../shared/interfaces/subscription.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { ToastService } from '../../../shared/services/toast.service';
import { VendorBillingService } from '../../../shared/services/vendor-billing.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { money } from '../../../shared/utils/money.utils';
import { parsePrice } from '../../../shared/utils/pricing.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';

/**
 * The vendor: who signed up, their plan and term; a longer free period, an invoice by hand (Enterprise),
 * «оплачено» — that extends the access of the client.
 */
@Component({
  selector: 'app-vendor-subscriptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, UaDatePipe, DateInputComponent],
  templateUrl: './vendor-subscriptions.component.html',
})
export class VendorSubscriptionsComponent {
  private readonly service = inject(VendorBillingService);
  private readonly toast = inject(ToastService);
  private readonly refresh = injectRouteRefresh();

  /** vendorSubscriptionsResolver */
  readonly data = input.required<VendorBillingData>();

  protected readonly planLabels = PLAN_LABELS;
  protected readonly stateLabels = SUBSCRIPTION_STATE_LABELS;
  protected readonly statusLabels = INVOICE_STATUS_LABELS;
  protected readonly money = money;

  protected readonly selectedId = signal<string | null>(null);
  protected readonly trialUntil = signal('');
  protected readonly months = signal('1');
  protected readonly total = signal('');
  protected readonly description = signal('');
  protected readonly busy = signal(false);

  protected select(row: VendorSubscriptionRow) {
    this.selectedId.set(this.selectedId() === row.id ? null : row.id);
    this.trialUntil.set(row.trialUntil);
    this.months.set(row.plan === 'YEARLY' ? '12' : '1');
    this.total.set('');
    this.description.set('');
  }

  private async run(action: () => Promise<unknown>, done: string) {
    this.busy.set(true);
    try {
      await action();
      this.toast.success(done);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося виконати дію'));
    } finally {
      this.busy.set(false);
    }
  }

  protected extendTrial(row: VendorSubscriptionRow) {
    const until = this.trialUntil();
    if (!until) return;
    void this.run(() => this.service.extendTrial(row.id, until), 'Пробний період змінено');
  }

  protected issue(row: VendorSubscriptionRow) {
    const total = parsePrice(this.total());
    const months = Number(this.months());
    if (total === null || Number.isNaN(total) || total < 1) {
      this.toast.error('Вкажіть суму, грн');
      return;
    }
    if (!Number.isInteger(months) || months < 1 || months > 36) {
      this.toast.error('Місяців — від 1 до 36');
      return;
    }
    void this.run(
      () =>
        this.service.issueInvoice(row.id, {
          months,
          total,
          description: this.description().trim(),
        }),
      'Рахунок виставлено',
    );
  }

  protected markPaid(inv: InvoiceView) {
    void this.run(
      () => this.service.markPaid(inv.id),
      `Рахунок № ${inv.number} оплачено — доступ продовжено`,
    );
  }

  protected cancel(inv: InvoiceView) {
    void this.run(() => this.service.cancel(inv.id), `Рахунок № ${inv.number} скасовано`);
  }

  protected invoiceUrl(id: string) {
    return this.service.invoiceUrl(id);
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
