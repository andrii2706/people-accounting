import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { OperationalReport } from '../../../shared/interfaces/report.interface';
import { LettersService } from '../../../shared/services/letters.service';
import { NavigationStateService } from '../../../shared/services/navigation-state.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectQueryParamsUpdate } from '../../../shared/utils/router.utils';

@Component({
  selector: 'app-operational',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent],
  templateUrl: './operational.component.html',
})
export class OperationalComponent {
  private readonly lettersService = inject(LettersService);
  protected readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly today = todayIso();
  private readonly updateQuery = injectQueryParamsUpdate();
  protected readonly isLoading = inject(NavigationStateService).isNavigating;

  /** Відомість з operationalReportResolver; дата — у query-параметрі ?date=. */
  readonly report = input.required<OperationalReport>();
  protected readonly date = computed(() => this.report().date);
  protected readonly rows = computed(() => this.report().rows);
  protected readonly busy = signal(false);

  protected setDate(date: string) {
    void this.updateQuery({ date: date && date !== this.today ? date : '' });
  }

  protected async register() {
    this.busy.set(true);
    try {
      const letter = await this.lettersService.createReport({
        type: 'OPERATIONAL_REPORT',
        reportDate: this.date(),
      });
      this.toast.success(`Зареєстровано вих. № ${letter.number}`);
      await this.router.navigate(['/letters', letter.id]);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
