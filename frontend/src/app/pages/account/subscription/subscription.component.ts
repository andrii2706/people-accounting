import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import {
  INVOICE_STATUS_LABELS,
  PLAN_LABELS,
  SUBSCRIPTION_STATE_LABELS,
} from '../../../shared/constants/subscription.constants';
import type { SubscriptionView } from '../../../shared/interfaces/subscription.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AccountService } from '../../../shared/services/account.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { money } from '../../../shared/utils/money.utils';
import { injectRouteRefresh } from '../../../shared/utils/router.utils';

/** The term of access, the plan, the invoices (.docx) and «Сформувати рахунок». */
@Component({
  selector: 'app-subscription',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink, UaDatePipe],
  templateUrl: './subscription.component.html',
})
export class SubscriptionComponent {
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly refresh = injectRouteRefresh();

  /** subscriptionResolver */
  readonly data = input.required<SubscriptionView>();

  protected readonly planLabels = PLAN_LABELS;
  protected readonly stateLabels = SUBSCRIPTION_STATE_LABELS;
  protected readonly statusLabels = INVOICE_STATUS_LABELS;
  protected readonly money = money;
  protected readonly issuing = signal(false);

  protected readonly openInvoice = computed(() =>
    this.data().invoices.find((i) => i.status === 'ISSUED'),
  );
  /** Work is allowed: in trial or paid. */
  protected readonly canWork = computed(() => ['TRIAL', 'ACTIVE'].includes(this.data().state));
  /** A new invoice makes sense: a fixed plan, no unpaid one, the requisites are there. */
  protected readonly canRenew = computed(() => {
    const d = this.data();
    return (
      d.canManage && d.sellerReady && !!d.plan && d.plan !== 'ENTERPRISE' && !this.openInvoice()
    );
  });

  protected invoiceUrl(id: string) {
    return this.account.invoiceUrl(id);
  }

  protected async renew() {
    this.issuing.set(true);
    try {
      const invoice = await this.account.renew();
      this.toast.success(`Рахунок № ${invoice.number} сформовано`);
      await this.refresh();
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося сформувати рахунок'));
    } finally {
      this.issuing.set(false);
    }
  }

  protected async toWork() {
    this.account.forget();
    await this.router.navigateByUrl('/');
  }
}
