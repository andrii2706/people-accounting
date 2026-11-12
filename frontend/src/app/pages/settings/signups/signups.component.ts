import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SIGNUP_REASON_LABELS } from '../../../shared/constants/subscription.constants';
import type { SignupRequestView } from '../../../shared/interfaces/auth.interface';
import { UaDateTimePipe } from '../../../shared/pipes/ua-date-time.pipe';

/** The main administrator: who signed up which legal entity with KEP, and the refused attempts. */
@Component({
  selector: 'app-signups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, RouterLink, UaDateTimePipe],
  templateUrl: './signups.component.html',
})
export class SignupsComponent {
  /** signupsResolver */
  readonly rows = input.required<SignupRequestView[]>();

  protected readonly reasons = SIGNUP_REASON_LABELS;
  protected readonly onlyRefused = signal(false);
  protected readonly shown = computed(() =>
    this.onlyRefused() ? this.rows().filter((r) => r.status === 'REJECTED') : this.rows(),
  );
  protected readonly refused = computed(
    () => this.rows().filter((r) => r.status === 'REJECTED').length,
  );
}
