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
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import type { ListSection } from '../../../shared/interfaces/dictionary.interface';
import type { ListsReport } from '../../../shared/interfaces/report.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { LettersService } from '../../../shared/services/letters.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectQueryParamsUpdate } from '../../../shared/utils/router.utils';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';

/** Short column titles for the on-screen preview; the .docx uses the full titles of the form. */
const COLUMNS = [
  '№',
  'Категорія',
  'Звання',
  'ПІБ',
  'Дата народж.',
  'Номер в ЄДР',
  'РНОКПП',
  'ВОС',
  'Військово-обліковий документ',
  'Паспорт',
  'Адреса',
  'ТЦК та СП',
  'Відстрочка',
  'Спецоблік (бронювання)',
  'Військова служба',
  'Моброзпорядження',
  'Посада, наказ',
  'Повідомлення ТЦК, відмітки',
];

/** Four lists: officers; rank-and-file, sergeants, petty officers; women; conscripts. */
const SECTIONS: ListSection[] = ['OFFICERS', 'SOLDIERS', 'WOMEN', 'CONSCRIPTS'];

@Component({
  selector: 'app-lists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateInputComponent, PageHeaderComponent, IconComponent, RouterLink],
  templateUrl: './lists.component.html',
})
export class ListsComponent {
  private readonly lettersService = inject(LettersService);
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly dictionaries = inject(DictionariesService);

  protected readonly today = todayIso();
  protected readonly columns = COLUMNS;
  private readonly updateQuery = injectQueryParamsUpdate();

  /** Report from listsReportResolver; the date lives in the ?date= query parameter. */
  readonly report = input.required<ListsReport>();
  protected readonly date = computed(() => this.report().date);
  protected readonly busy = signal(false);
  protected readonly total = computed(() => this.report().rows.length);
  /** Non-empty lists — every one is a separate list in the document. */
  protected readonly groups = computed(() =>
    SECTIONS.map((group) => ({
      group,
      rows: this.report().rows.filter((r) => r.section === group),
    })).filter((g) => g.rows.length),
  );
  private readonly titles = computed(
    () =>
      new Map(
        (this.dictionaries.dictionaries()?.listSections ?? []).map((s) => [s.value, s.label]),
      ),
  );

  protected title(section: ListSection) {
    return this.titles().get(section) ?? section;
  }
  /** Preview filter only — the document always contains all groups. Reset when the date changes. */
  protected readonly filter = linkedSignal<ListsReport, ListSection | 'ALL'>({
    source: this.report,
    computation: () => 'ALL',
  });
  protected readonly visibleGroups = computed(() => {
    const f = this.filter();
    return f === 'ALL' ? this.groups() : this.groups().filter((g) => g.group === f);
  });

  protected setDate(date: string) {
    // the field reports every keystroke — react only to a complete date or clearing
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    void this.updateQuery({ date: date && date !== this.today ? date : '' });
  }

  protected readonly downloadUrl = computed(() => this.reportsService.listsDocxUrl(this.date()));

  /** Registers an outgoing letter — the document gets a number and a date. */
  protected async register() {
    this.busy.set(true);
    try {
      const letter = await this.lettersService.createReport({
        type: 'LISTS',
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
