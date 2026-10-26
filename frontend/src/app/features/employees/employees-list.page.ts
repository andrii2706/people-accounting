import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import type { EmployeeList } from '../../core/api/api.types';
import { DictionariesStore } from '../../core/api/dictionaries.store';
import { CategoryBadge, GroupBadge, WarningsList } from '../../shared/badges';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { UaDatePipe } from '../../shared/ua-date.pipe';

type StatusFilter = 'active' | 'dismissed' | 'all';

@Component({
  selector: 'app-employees-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink, Icon, CategoryBadge, GroupBadge, WarningsList, UaDatePipe],
  template: `
    <app-page-header title="Працівники" eyebrow="Персональний облік" [subtitle]="subtitle()">
      <a class="btn btn-secondary" [href]="exportUrl()" download><app-icon name="download" /> Списки .docx</a>
      <a routerLink="/employees/new" class="btn btn-primary"><app-icon name="plus" /> Додати</a>
    </app-page-header>

    <div class="card mb-4 flex flex-wrap items-end gap-3 p-3">
      <label class="relative min-w-[240px] flex-1">
        <span class="sr-only">Пошук</span>
        <app-icon name="search" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted" [size]="16" />
        <input class="input pl-9" type="search" placeholder="ПІБ, РНОКПП, табельний №, посада" [value]="search()" (input)="search.set($any($event.target).value)" />
      </label>

      <div class="flex rounded-lg border border-line bg-sunken p-0.5 text-sm" role="group" aria-label="Статус">
        @for (opt of statusOptions; track opt.value) {
          <button type="button" class="rounded-md px-3 py-1.5" [class]="status() === opt.value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-ink'" (click)="status.set(opt.value)">
            {{ opt.label }}
          </button>
        }
      </div>

      <select class="input w-full sm:w-auto sm:max-w-xs" (change)="groupFilter.set($any($event.target).value)" aria-label="Група списку">
        <option value="">Усі групи</option>
        @for (g of dict.dictionaries()?.listGroups ?? []; track g.value) {
          <option [value]="g.value" [selected]="g.value === groupFilter()">{{ g.value }} — {{ g.label }}</option>
        }
        <option value="NONE" [selected]="groupFilter() === 'NONE'">Не на обліку / не заповнено</option>
      </select>

      <select class="input w-full sm:w-auto" (change)="category.set($any($event.target).value)" aria-label="Категорія">
        <option value="">Усі категорії</option>
        @for (c of dict.dictionaries()?.dutyCategories ?? []; track c.value) {
          <option [value]="c.value" [selected]="c.value === category()">{{ c.label }}</option>
        }
      </select>

      <label class="flex items-center gap-2 px-1 py-2 text-sm text-muted">
        <input type="checkbox" class="size-4 accent-brand-600" [checked]="onlyWarnings()" (change)="onlyWarnings.set($any($event.target).checked)" />
        Лише з попередженнями
      </label>
    </div>

    <div class="card overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr>
            <th>Працівник</th>
            <th>Категорія</th>
            <th>Група</th>
            <th>Звання / ВОС</th>
            <th>ТЦК та СП</th>
            <th>Увага</th>
            <th class="text-right">Прийнятий</th>
          </tr>
        </thead>
        <tbody [class.opacity-50]="employees.isLoading()">
          @for (e of items(); track e.id) {
            <tr>
              <td class="min-w-[240px]">
                <a [routerLink]="['/employees', e.id]" class="font-medium text-ink hover:text-brand-600">{{ e.fullName }}</a>
                <p class="text-xs text-muted">
                  @if (e.personnelNumber) { <span class="font-mono">№ {{ e.personnelNumber }}</span> · }
                  {{ e.position || 'посада не вказана' }}
                  @if (e.age !== null) { · {{ e.age }} р. }
                </p>
                @if (e.dismissalDate) {
                  <p class="text-xs text-danger">звільнений {{ e.dismissalDate | uaDate }}</p>
                }
                @if (e.mobilized) {
                  <p class="text-xs text-info">мобілізований</p>
                }
              </td>
              <td><app-category-badge [category]="e.dutyCategory" /></td>
              <td><app-group-badge [group]="e.listGroup" [title]="dict.groupTitle(e.listGroup)" /></td>
              <td class="text-sm">
                {{ e.rankTitle || (e.rankCode === 0 ? 'призовник' : '—') }}
                @if (e.vos) { <p class="font-mono text-xs text-muted">ВОС {{ e.vos }}</p> }
              </td>
              <td class="max-w-[220px] text-sm text-muted">{{ e.tckName || '—' }}</td>
              <td class="min-w-[200px]">
                @if (e.pendingChanges) {
                  <a routerLink="/notifications" class="mb-1 inline-flex items-center gap-1 rounded-full bg-[#f6ecdf] px-2 py-0.5 text-xs font-medium text-warning">
                    <app-icon name="bell" [size]="12" /> {{ e.pendingChanges }} до ТЦК
                  </a>
                }
                <app-warnings [warnings]="e.warnings" />
              </td>
              <td class="text-right text-sm whitespace-nowrap tabular-nums">{{ e.hireDate | uaDate }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="py-12 text-center text-sm text-muted">
                @if (employees.isLoading()) { Завантаження… } @else { Нікого не знайдено за цими умовами. }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class EmployeesListPage {
  protected readonly dict = inject(DictionariesStore);

  /** Початкові фільтри з query-параметрів (?group=G1&status=all). */
  readonly group = input<string>('');
  readonly statusParam = input<string>('', { alias: 'status' });

  protected readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Працюють' },
    { value: 'dismissed', label: 'Звільнені' },
    { value: 'all', label: 'Усі' },
  ];

  protected readonly search = signal('');
  protected readonly status = linkedSignal<StatusFilter>(() => (this.statusParam() as StatusFilter) || 'active');
  protected readonly groupFilter = linkedSignal(() => this.group());
  protected readonly category = signal('');
  protected readonly onlyWarnings = signal(false);

  private readonly debouncedSearch = toSignal(
    toObservable(this.search).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly employees = httpResource<EmployeeList>(() => ({
    url: '/api/employees',
    params: {
      status: this.status(),
      ...(this.debouncedSearch() ? { search: this.debouncedSearch() } : {}),
      ...(this.groupFilter() ? { group: this.groupFilter() } : {}),
      ...(this.category() ? { category: this.category() } : {}),
      ...(this.onlyWarnings() ? { withWarnings: 'true' } : {}),
    },
  }));

  protected readonly items = computed(() => this.employees.value()?.items ?? []);
  protected readonly subtitle = computed(() => {
    const total = this.employees.value()?.total;
    return total === undefined ? 'Завантаження…' : `Знайдено: ${total}`;
  });
  protected readonly exportUrl = computed(() => `/api/reports/lists/docx${this.groupFilter() && this.groupFilter() !== 'NONE' ? `?groups=${this.groupFilter()}` : ''}`);
}
