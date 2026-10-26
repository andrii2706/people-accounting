import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { CategoryBadgeComponent } from '../../../shared/components/category-badge/category-badge.component';
import { GroupBadgeComponent } from '../../../shared/components/group-badge/group-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { WarningsListComponent } from '../../../shared/components/warnings-list/warnings-list.component';
import type { EmployeeList } from '../../../shared/interfaces/employee.interface';
import { UaDatePipe } from '../../../shared/pipes/ua-date.pipe';
import { DictionariesService } from '../../../shared/services/dictionaries.service';
import { NavigationStateService } from '../../../shared/services/navigation-state.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { injectQueryParamsUpdate } from '../../../shared/utils/router.utils';

type StatusFilter = 'active' | 'dismissed' | 'all';

/**
 * Список працівників. Дані — з employeeListResolver, фільтри — у query-параметрах URL:
 * зміна фільтра = навігація, яка перезапускає резолвер (посилання на відфільтрований список можна зберегти).
 */
@Component({
  selector: 'app-employee-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    RouterLink,
    IconComponent,
    CategoryBadgeComponent,
    GroupBadgeComponent,
    WarningsListComponent,
    UaDatePipe,
  ],
  templateUrl: './employee-list.component.html',
})
export class EmployeeListComponent {
  protected readonly dict = inject(DictionariesService);
  private readonly reportsService = inject(ReportsService);
  private readonly updateQuery = injectQueryParamsUpdate();
  protected readonly isLoading = inject(NavigationStateService).isNavigating;

  /** Дані з резолвера. */
  readonly list = input.required<EmployeeList>();

  /** Фільтри з query-параметрів. */
  readonly search = input('');
  readonly status = input<StatusFilter | ''>('');
  readonly group = input('');
  readonly category = input('');
  readonly warnings = input('');

  protected readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Працюють' },
    { value: 'dismissed', label: 'Звільнені' },
    { value: 'all', label: 'Усі' },
  ];

  protected readonly currentStatus = computed<StatusFilter>(() => this.status() || 'active');
  protected readonly onlyWarnings = computed(() => this.warnings() === '1');

  /** Текст у полі пошуку — локальний, у URL потрапляє з затримкою. */
  protected readonly searchText = linkedSignal(() => this.search());

  protected readonly items = computed(() => this.list().items);
  protected readonly subtitle = computed(() => `Знайдено: ${this.list().total}`);
  protected readonly exportUrl = computed(() =>
    this.reportsService.listsDocxUrl(
      undefined,
      this.group() && this.group() !== 'NONE' ? this.group() : null,
    ),
  );

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

  protected setStatus(status: StatusFilter) {
    void this.updateQuery({ status: status === 'active' ? '' : status });
  }

  protected setGroup(group: string) {
    void this.updateQuery({ group });
  }

  protected setCategory(category: string) {
    void this.updateQuery({ category });
  }

  protected setOnlyWarnings(value: boolean) {
    void this.updateQuery({ warnings: value ? '1' : '' });
  }
}
