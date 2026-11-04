import { AuthService } from '../../../shared/services/auth.service';
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
import { injectQueryParamsUpdate, orEmpty } from '../../../shared/utils/router.utils';
import { LegalEntityFilterComponent } from '../../../shared/components/legal-entity-filter/legal-entity-filter.component';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';

@Component({
  selector: 'app-operational',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateInputComponent, PageHeaderComponent, IconComponent, LegalEntityFilterComponent],
  templateUrl: './operational.component.html',
})
export class OperationalComponent {
  protected readonly auth = inject(AuthService);
  private readonly lettersService = inject(LettersService);
  protected readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly today = todayIso();
  private readonly updateQuery = injectQueryParamsUpdate();
  protected readonly isLoading = inject(NavigationStateService).isNavigating;

  /** Report from operationalReportResolver; the date lives in the ?date= query parameter. */
  readonly report = input.required<OperationalReport>();
  protected readonly date = computed(() => this.report().date);
  protected readonly rows = computed(() => this.report().rows);
  protected readonly busy = signal(false);
  private readonly dict = inject(DictionariesService);
  /** ?entity= — one legal entity; with several, the document needs one. */
  readonly entity = input<string, string | undefined>('', { transform: orEmpty });
  protected readonly needsEntity = computed(
    () => this.dict.severalLegalEntities() && !this.entity(),
  );
  protected readonly downloadUrl = computed(() =>
    this.reportsService.operationalDocxUrl(this.date(), this.entity()),
  );

  protected setEntity(entity: string) {
    void this.updateQuery({ entity });
  }

  protected setDate(date: string) {
    // the field reports every keystroke — react only to a complete date or clearing
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    void this.updateQuery({ date: date && date !== this.today ? date : '' });
  }

  protected async register() {
    this.busy.set(true);
    try {
      const letter = await this.lettersService.createReport({
        type: 'OPERATIONAL_REPORT',
        reportDate: this.date(),
        legalEntityId: this.entity() || undefined,
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
