import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BILLING_TEXT } from '../../constants/billing.constants';
import type { BillingStatus } from '../../interfaces/billing.interface';
import { UaDatePipe } from '../../pipes/ua-date.pipe';
import { formatUah } from '../../utils/billing.utils';
import { IconComponent } from '../icon/icon.component';

/** The block after a sign-in: «Ласкаво просимо» or «Є заборгованість» with the details that are set. */
@Component({
  selector: 'app-billing-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, UaDatePipe],
  templateUrl: './billing-notice.component.html',
})
export class BillingNoticeComponent {
  readonly status = input.required<BillingStatus>();
  /** First name of the user for «Ласкаво просимо, …». */
  readonly name = input('');

  protected readonly text = BILLING_TEXT;
  protected readonly formatUah = formatUah;
}
