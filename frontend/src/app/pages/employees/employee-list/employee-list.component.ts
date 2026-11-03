import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type {
  EmployeeList,
  EmployeeListItem,
  EmployeeView,
} from '../../../shared/interfaces/employee.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { NavigationStateService } from '../../../shared/services/navigation-state.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { injectQueryParamsUpdate, orEmpty } from '../../../shared/utils/router.utils';
import { EmployeePreviewComponent } from '../employee-preview/employee-preview.component';
import { InViewDirective } from '../../../shared/directives/in-view.directive';
import {
  EMPLOYEE_LIST_PAGE_SIZE,
  EMPLOYEE_VIEWS,
} from '../../../shared/constants/employee.constants';
import {
  hasDanger,
  initials,
  matchesView,
  statusBadges,
  warningCount,
} from '../../../shared/utils/employee-list.utils';

@Component({
  selector: 'app-employee-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, UaDatePipe, EmployeePreviewComponent, InViewDirective],
  templateUrl: './employee-list.component.html',
})
export class EmployeeListComponent {
  protected readonly dict = inject(DictionariesService);
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly updateQuery = injectQueryParamsUpdate();
  protected readonly isLoading = inject(NavigationStateService).isNavigating;

  readonly list = input.required<EmployeeList>();

  readonly search = input<string, string | undefined>('', { transform: orEmpty });
  readonly status = input<string, string | undefined>('', { transform: orEmpty });
  readonly group = input<string, string | undefined>('', { transform: orEmpty });
  readonly category = input<string, string | undefined>('', { transform: orEmpty });
  readonly view = input<string, string | undefined>('', { transform: orEmpty });
  /** Old links: ?warnings=1 is the «Потребують уваги» tab. */
  readonly warnings = input<string, string | undefined>('', { transform: orEmpty });

  protected readonly views = EMPLOYEE_VIEWS;
  protected readonly currentView = computed<EmployeeView>(() => {
    if (this.status() === 'dismissed') return 'dismissed';
    if (this.warnings() === '1') return 'attention';
    const v = this.view() as EmployeeView;
    return EMPLOYEE_VIEWS.some((x) => x.value === v) ? v : 'all';
  });

  /** Search box text — local; it reaches the URL with a debounce. */
  protected readonly searchText = linkedSignal(() => this.search());

  /** Employees of the current list (dismissed or working), before the tab filter. */
  private readonly loaded = computed(() => this.list().items);
  protected readonly items = computed(() =>
    this.loaded().filter((e) => matchesView(e, this.currentView())),
  );
  /**
   * Rows are drawn in portions of EMPLOYEE_LIST_PAGE_SIZE: a thousand rows at once is ~30 000 DOM nodes and seconds of work
   * on an office laptop. The next portion is added when the end of the table scrolls into view.
   */
  protected readonly shownCount = linkedSignal({
    source: this.items,
    computation: () => EMPLOYEE_LIST_PAGE_SIZE,
  });
  protected readonly shown = computed(() => this.items().slice(0, this.shownCount()));
  protected readonly hasMore = computed(() => this.shownCount() < this.items().length);

  protected showMore() {
    if (this.hasMore()) this.shownCount.update((n) => n + EMPLOYEE_LIST_PAGE_SIZE);
  }

  protected readonly counts = computed(() => {
    const all = this.loaded();
    const working = this.currentView() !== 'dismissed';
    return new Map<EmployeeView, number | null>(
      EMPLOYEE_VIEWS.map((v) => [
        v.value,
        v.value === 'dismissed' || !working
          ? null
          : all.filter((e) => matchesView(e, v.value)).length,
      ]),
    );
  });
  protected readonly onListsCount = computed(() => this.loaded().filter((e) => e.onLists).length);

  protected readonly exportUrl = computed(() => this.reportsService.listsDocxUrl());

  /** Selected rows (bulk actions); reset when the list changes. */
  protected readonly selected = linkedSignal<EmployeeListItem[], ReadonlySet<string>>({
    source: this.items,
    computation: (items, previous) => {
      const ids = new Set(items.map((i) => i.id));
      return new Set([...(previous?.value ?? [])].filter((id) => ids.has(id)));
    },
  });
  protected readonly allSelected = computed(
    () => this.items().length > 0 && this.items().every((i) => this.selected().has(i.id)),
  );
  protected readonly selectedExtractUrl = computed(() =>
    this.reportsService.listsDocxUrl(undefined, [...this.selected()]),
  );

  /** Employee shown in the side panel. */
  protected readonly previewId = signal<string | null>(null);
  protected readonly previewItem = computed(
    () => this.loaded().find((e) => e.id === this.previewId()) ?? null,
  );

  protected readonly groupOptions = computed(() => [
    ...(this.dict.dictionaries()?.listGroups ?? []).map((g) => ({
      value: g.value,
      label: `${g.value} — ${g.label}`,
    })),
    { value: 'NONE', label: 'Не на обліку / не заповнено' },
  ]);
  protected readonly categoryOptions = computed(() =>
    (this.dict.dictionaries()?.dutyCategories ?? []).map((c) => ({
      value: c.value,
      label: c.label,
    })),
  );
  protected readonly groupLabel = computed(
    () => this.groupOptions().find((o) => o.value === this.group())?.label ?? '',
  );
  protected readonly categoryLabel = computed(
    () => this.categoryOptions().find((o) => o.value === this.category())?.label ?? '',
  );

  protected readonly initials = initials;
  protected readonly statusBadges = statusBadges;
  protected readonly warningCount = warningCount;
  protected readonly hasDanger = hasDanger;

  constructor() {
    toObservable(this.searchText)
      .pipe(
        skip(1),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((search) => {
        if (search !== this.search()) void this.updateQuery({ search: search.trim() });
      });
  }

  protected setView(view: EmployeeView) {
    this.previewId.set(null);
    void this.updateQuery({
      status: view === 'dismissed' ? 'dismissed' : '',
      view: view === 'all' || view === 'dismissed' ? '' : view,
      warnings: '',
    });
  }

  protected setGroup(group: string) {
    void this.updateQuery({ group });
  }

  protected setCategory(category: string) {
    void this.updateQuery({ category });
  }

  protected toggle(id: string) {
    this.selected.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected toggleAll() {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.items().map((i) => i.id)));
  }

  protected clearSelection() {
    this.selected.set(new Set());
  }

  protected preview(item: EmployeeListItem) {
    this.previewId.set(this.previewId() === item.id ? null : item.id);
  }

  protected edit(item: EmployeeListItem) {
    void this.router.navigate(['/employees', item.id, 'edit']);
  }

  protected copy(item: EmployeeListItem) {
    void this.router.navigate(['/employees', 'new'], { queryParams: { copy: item.id } });
  }
}
