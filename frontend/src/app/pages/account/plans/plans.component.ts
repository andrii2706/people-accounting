import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type {
  PlanCode,
  PlanOffer,
  SubscriptionView,
} from '../../../shared/interfaces/subscription.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { AccountService } from '../../../shared/services/account.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { money } from '../../../shared/utils/money.utils';

/** Three plans: monthly, yearly, Enterprise (a request). The choice issues the first invoice. */
@Component({
  selector: 'app-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink, UaDatePipe],
  templateUrl: './plans.component.html',
})
export class PlansComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** subscriptionResolver */
  readonly data = input.required<SubscriptionView>();

  protected readonly selected = linkedSignal<PlanCode | null>(() => this.data().plan);
  protected readonly note = signal('');
  protected readonly saving = signal(false);
  protected readonly money = money;

  protected available(p: PlanOffer): boolean {
    return p.plan === 'ENTERPRISE' || p.price !== null;
  }

  protected async choose() {
    const plan = this.selected();
    if (!plan) return;
    this.saving.set(true);
    try {
      await this.account.choosePlan(plan, plan === 'ENTERPRISE' ? this.note() : '');
      this.toast.success(
        plan === 'ENTERPRISE'
          ? 'Заявку надіслано — ми зв’яжемося з вами'
          : 'Тариф обрано — рахунок на оплату нижче',
      );
      await this.router.navigateByUrl('/account/subscription');
    } catch (err) {
      this.toast.error(apiErrorMessage(err, 'Не вдалося обрати тариф'));
    } finally {
      this.saving.set(false);
    }
  }
}
