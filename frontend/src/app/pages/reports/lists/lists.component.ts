import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { ListGroup } from '../../../shared/interfaces/dictionary.interface';
import type { ListsReport } from '../../../shared/interfaces/report.interface';
import { LettersService } from '../../../shared/services/letters.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectQueryParamsUpdate } from '../../../shared/utils/router.utils';

/** Колонки, видимі у попередньому перегляді (повний набір із 18 — у .docx). */
const PREVIEW_COLUMNS: { index: number; label: string; width?: string }[] = [
  { index: 0, label: '№' },
  { index: 1, label: 'Звання' },
  { index: 2, label: 'ПІБ', width: 'min-w-[200px]' },
  { index: 3, label: 'Народж.' },
  { index: 4, label: 'ЄДР / РНОКПП' },
  { index: 5, label: 'ВОС' },
  { index: 7, label: 'Категорія, ВОД', width: 'min-w-[200px]' },
  { index: 12, label: 'ТЦК', width: 'min-w-[180px]' },
  { index: 13, label: 'Спецоблік / резерв', width: 'min-w-[180px]' },
  { index: 14, label: 'Придатність' },
  { index: 16, label: 'Посада, акт', width: 'min-w-[220px]' },
  { index: 17, label: 'Повідомлення ТЦК', width: 'min-w-[160px]' },
];

@Component({
  selector: 'app-lists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, RouterLink],
  templateUrl: './lists.component.html',
})
export class ListsComponent {
  private readonly lettersService = inject(LettersService);
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly today = todayIso();
  protected readonly columns = PREVIEW_COLUMNS;
  private readonly updateQuery = injectQueryParamsUpdate();

  /** Звіт з listsReportResolver; дата — у query-параметрі ?date=. */
  readonly report = input.required<ListsReport>();
  protected readonly date = computed(() => this.report().date);
  protected readonly active = signal<ListGroup>('G1');
  protected readonly busy = signal(false);
  protected readonly groups = computed(() => this.report().groups);
  protected readonly current = computed(() => this.groups().find((g) => g.group === this.active()));

  protected setDate(date: string) {
    void this.updateQuery({ date: date && date !== this.today ? date : '' });
  }

  protected downloadUrl(group: ListGroup | null) {
    return this.reportsService.listsDocxUrl(this.date(), group);
  }

  /** Створює запис у журналі вихідних — документ отримає номер і дату. */
  protected async register() {
    this.busy.set(true);
    try {
      const nonEmpty = this.groups()
        .filter((g) => g.rows.length)
        .map((g) => g.group);
      const letter = await this.lettersService.createReport({
        type: 'LISTS',
        reportDate: this.date(),
        groups: nonEmpty.length ? nonEmpty : undefined,
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
