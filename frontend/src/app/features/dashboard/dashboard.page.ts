import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Dashboard, ListGroup } from '../../core/api/api.types';
import { DictionariesStore } from '../../core/api/dictionaries.store';
import { AuthStore } from '../../core/auth/auth.store';
import { WarningsList } from '../../shared/badges';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { UaDatePipe } from '../../shared/ua-date.pipe';

const GROUP_ORDER: ListGroup[] = ['G1', 'G1R', 'G2', 'G2R', 'G3', 'G3R', 'G4', 'G4R'];

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink, Icon, WarningsList, UaDatePipe],
  template: `
    <app-page-header
      eyebrow="Огляд"
      [title]="greeting()"
      [subtitle]="'Стан військового обліку станом на ' + (data()?.date | uaDate)"
    >
      <a routerLink="/employees/new" class="btn btn-primary"><app-icon name="plus" /> Додати працівника</a>
    </app-page-header>

    @if (dashboard.error()) {
      <div class="card p-6 text-sm text-danger">Не вдалося завантажити дані.</div>
    } @else if (data(); as d) {
      @if (!d.organizationConfigured) {
        <a routerLink="/settings" class="mb-6 flex items-center gap-3 rounded-xl border border-warning/30 bg-[#fdf6ec] px-4 py-3 text-sm text-warning">
          <app-icon name="alert" /> Заповніть реквізити підприємства — вони потрібні для всіх документів.
        </a>
      }

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="card p-5">
          <p class="label">Працюють</p>
          <p class="text-3xl font-semibold tabular-nums">{{ d.employees.employed }}</p>
          <p class="mt-1 text-xs text-muted">у списках обліку: {{ d.employees.onLists }}</p>
        </div>
        <a routerLink="/notifications" class="card group p-5 transition-colors hover:border-brand-500">
          <p class="label">Очікують повідомлення ТЦК</p>
          <p class="text-3xl font-semibold tabular-nums" [class.text-warning]="d.pendingChanges > 0">{{ d.pendingChanges }}</p>
          <p class="mt-1 text-xs" [class]="d.overdueChanges ? 'text-danger' : 'text-muted'">
            {{ d.overdueChanges ? 'прострочено: ' + d.overdueChanges : 'усе вчасно' }}
          </p>
        </a>
        <div class="card p-5">
          <p class="label">Заброньовані</p>
          <p class="text-3xl font-semibold tabular-nums">{{ d.employees.reserved }}</p>
          <p class="mt-1 text-xs text-muted">мобілізовано: {{ d.employees.mobilized }}</p>
        </div>
        <div class="card p-5">
          <p class="label">За категоріями</p>
          <dl class="mt-2 space-y-1 text-sm">
            <div class="flex justify-between"><dt class="text-muted">Військовозобов’язані</dt><dd class="font-medium tabular-nums">{{ d.byCategory.LIABLE }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Резервісти</dt><dd class="font-medium tabular-nums">{{ d.byCategory.RESERVIST }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Призовники</dt><dd class="font-medium tabular-nums">{{ d.byCategory.CONSCRIPT }}</dd></div>
          </dl>
        </div>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section class="card p-5">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-semibold">Групи списків (Додаток 13)</h2>
            <a routerLink="/reports/lists" class="text-sm text-brand-600 hover:underline">Відкрити списки</a>
          </div>
          <ul class="space-y-2.5">
            @for (row of groups(); track row.group) {
              <li>
                <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span class="truncate"><span class="mr-2 font-mono text-xs font-semibold text-muted">{{ row.group }}</span>{{ row.title }}</span>
                  <span class="font-medium tabular-nums">{{ row.count }}</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div class="h-full rounded-full bg-brand-500" [style.width.%]="row.share"></div>
                </div>
              </li>
            }
          </ul>
        </section>

        <section class="card p-5">
          <h2 class="mb-4 font-semibold">Потребують уваги</h2>
          @if (d.attention.length) {
            <ul class="divide-y divide-line">
              @for (item of d.attention; track item.id) {
                <li class="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <a [routerLink]="['/employees', item.id]" class="text-sm font-medium hover:text-brand-600">{{ item.fullName }}</a>
                  <app-warnings class="max-w-[60%]" [warnings]="item.warnings" />
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-muted">Немає попереджень: строки бронювання, відстрочки і граничний вік у нормі.</p>
          }
        </section>
      </div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="card h-28 animate-pulse bg-sunken/50"></div>
        }
      </div>
    }
  `,
})
export class DashboardPage {
  private readonly auth = inject(AuthStore);
  private readonly dict = inject(DictionariesStore);

  protected readonly dashboard = httpResource<Dashboard>(() => '/api/reports/dashboard');
  protected readonly data = computed(() => this.dashboard.value());

  protected readonly greeting = computed(() => {
    const name = this.auth.user()?.fullName.split(' ')[0];
    return name ? `Вітаємо, ${name}` : 'Огляд';
  });

  protected readonly groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    const max = Math.max(1, ...GROUP_ORDER.map((g) => d.byGroup[g]));
    return GROUP_ORDER.map((group) => ({
      group,
      title: this.dict.groupTitle(group),
      count: d.byGroup[group],
      share: (d.byGroup[group] / max) * 100,
    }));
  });
}
