import { AuthService } from '../../../shared/services/auth.service';
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
import type {
  ListQuickFilter,
  ListRow,
  ListsReport,
} from '../../../shared/interfaces/report.interface';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { LettersService } from '../../../shared/services/letters.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { ToastService } from '../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../shared/utils/api-error.utils';
import { todayIso } from '../../../shared/utils/date.utils';
import { injectQueryParamsUpdate, orEmpty } from '../../../shared/utils/router.utils';
import { ReportSwitchComponent } from '../../../shared/components/report-switch/report-switch.component';
import { LegalEntityFilterComponent } from '../../../shared/components/legal-entity-filter/legal-entity-filter.component';
import { InViewDirective } from '../../../shared/directives/in-view.directive';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';
import { CategoryBadgeComponent } from '../../../shared/components/category-badge/category-badge.component';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import {
  COL,
  DETAIL_GROUPS,
  LIST_COLUMN_MODES,
  LIST_COLUMNS,
  LIST_ROWS_PAGE,
  LIST_SECTION_ORDER,
  LIST_TABS,
  QUICK_FILTERS,
} from '../../../shared/constants/lists.constants';
import {
  filterRows,
  maskTaxNumber,
  matchesQuickFilter,
  splitTck,
} from '../../../shared/utils/lists-view.utils';

@Component({
  selector: 'app-lists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InViewDirective,
    DateInputComponent,
    PageHeaderComponent,
    IconComponent,
    RouterLink,
    CategoryBadgeComponent,
    UaDatePipe,
    LegalEntityFilterComponent,
    ReportSwitchComponent,
  ],
  templateUrl: './lists.component.html',
})
export class ListsComponent {
  protected readonly auth = inject(AuthService);
  private readonly lettersService = inject(LettersService);
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly dictionaries = inject(DictionariesService);

  protected readonly today = todayIso();
  protected readonly columns = LIST_COLUMNS;
  protected readonly columnModes = LIST_COLUMN_MODES;
  protected readonly col = COL;
  protected readonly detailGroups = DETAIL_GROUPS;
  protected readonly quickFilters = QUICK_FILTERS;
  protected readonly maskTaxNumber = maskTaxNumber;
  protected readonly splitTck = splitTck;
  protected readonly capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  private readonly updateQuery = injectQueryParamsUpdate();

  /** Report from listsReportResolver; the date lives in the ?date= query parameter. */
  readonly report = input.required<ListsReport>();
  protected readonly date = computed(() => this.report().date);
  /** ?entity= — one legal entity; with several, the document needs one. */
  readonly entity = input<string, string | undefined>('', { transform: orEmpty });
  protected readonly needsEntity = computed(
    () => this.dictionaries.severalLegalEntities() && !this.entity(),
  );
  protected readonly busy = signal(false);
  protected readonly total = computed(() => this.report().rows.length);
  private readonly titles = computed(
    () =>
      new Map(
        (this.dictionaries.dictionaries()?.listSections ?? []).map((s) => [s.value, s.label]),
      ),
  );

  protected title(section: ListSection) {
    return this.titles().get(section) ?? section;
  }

  protected readonly tabs = LIST_TABS;
  protected readonly sectionCounts = computed(() => {
    const counts = new Map<ListSection | 'ALL', number>([['ALL', this.total()]]);
    for (const r of this.report().rows) counts.set(r.section, (counts.get(r.section) ?? 0) + 1);
    return counts;
  });

  /* Preview state only — the document always contains all groups. Reset when the date changes. */
  protected readonly tab = linkedSignal<ListsReport, ListSection | 'ALL'>({
    source: this.report,
    computation: () => 'ALL',
  });
  protected readonly query = signal('');
  protected readonly quick = signal<ReadonlySet<ListQuickFilter>>(new Set());
  /** Full 18-column table — an exact copy of the form for checking against the .docx. */
  protected readonly wide = signal(false);
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  private readonly tabRows = computed(() => {
    const t = this.tab();
    return t === 'ALL' ? this.report().rows : this.report().rows.filter((r) => r.section === t);
  });
  protected readonly quickCounts = computed(
    () =>
      new Map(
        QUICK_FILTERS.map((f) => [
          f.value,
          this.tabRows().filter((r) => matchesQuickFilter(r, f.value)).length,
        ]),
      ),
  );
  protected readonly filtering = computed(() => !!this.query().trim() || this.quick().size > 0);
  /** Non-empty lists after the tab, search and quick filters. */
  protected readonly visibleGroups = computed(() => {
    const rows = filterRows(this.tabRows(), this.query(), this.quick());
    return LIST_SECTION_ORDER.map((group) => ({
      group,
      rows: rows.filter((r) => r.section === group),
    })).filter((g) => g.rows.length);
  });

  /** Rows drawn per list at once; more are added when the end of the list scrolls into view. */
  private readonly limits = linkedSignal<unknown, Partial<Record<ListSection, number>>>({
    source: this.visibleGroups,
    computation: () => ({}),
  });
  protected readonly shownGroups = computed(() =>
    this.visibleGroups().map((g) => {
      const limit = this.limits()[g.group] ?? LIST_ROWS_PAGE;
      return { ...g, shown: g.rows.slice(0, limit), hasMore: g.rows.length > limit };
    }),
  );

  protected showMore(group: ListSection) {
    this.limits.update((l) => ({ ...l, [group]: (l[group] ?? LIST_ROWS_PAGE) + LIST_ROWS_PAGE }));
  }

  protected toggleQuick(filter: ListQuickFilter) {
    this.quick.update((set) => {
      const next = new Set(set);
      if (!next.delete(filter)) next.add(filter);
      return next;
    });
  }

  protected resetFilters() {
    this.query.set('');
    this.quick.set(new Set());
  }

  protected isExpanded(row: ListRow) {
    return this.expanded().has(row.employeeId);
  }

  protected toggleRow(row: ListRow) {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (!next.delete(row.employeeId)) next.add(row.employeeId);
      return next;
    });
  }

  /** Cell by the column number of the form (1-based), «—» when empty. */
  protected cell(row: ListRow, column: number) {
    return row.cells[column - 1] || '—';
  }

  protected setDate(date: string) {
    // the field reports every keystroke — react only to a complete date or clearing
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    void this.updateQuery({ date: date && date !== this.today ? date : '' });
  }

  protected setEntity(entity: string) {
    void this.updateQuery({ entity });
  }

  protected readonly downloadUrl = computed(() =>
    this.reportsService.listsDocxUrl({ date: this.date(), entity: this.entity() }),
  );

  /** Registers an outgoing letter — the document gets a number and a date. */
  protected async register() {
    this.busy.set(true);
    try {
      const letter = await this.lettersService.createReport({
        type: 'LISTS',
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
